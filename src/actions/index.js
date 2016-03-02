import { getJSON } from '../api';

import * as commutable from 'commutable';

import { launchKernel as launchZmqKernel,
         listKernelSpecs as listZmqKernelSpecs
} from '../api/kernel-zmq'
import { launchKernel as launchSocketIoKernel,
         listKernelSpecs as listSocketIoKernelSpecs
} from '../api/kernel-socketio';

import { writeFile } from 'fs';

import {
  EXIT,
  KILL_KERNEL,
  NEW_KERNEL,
  START_SAVING,
  DONE_SAVING,
  CHANGE_FILENAME,
  SET_SELECTED,
  UPDATE_CELL_SOURCE,
  UPDATE_CELL_OUTPUTS,
  MOVE_CELL,
  NEW_CELL_AFTER,
  REMOVE_CELL,
  UPDATE_CELL_EXECUTION_COUNT,
  READ_NOTEBOOK,
  ERROR_KERNEL_NOT_CONNECTED,
} from './constants';

import {
  createExecuteRequest,
  msgSpecToNotebookFormat,
  childOf
} from '../api/messaging';

import Immutable from 'immutable';

const Rx = require('@reactivex/rxjs')
const Observable = Rx.Observable

export function exit() {
  return {
    type: EXIT,
  };
}

export function killKernel() {
  return {
    type: KILL_KERNEL,
  };
}

export function newKernel(kernelSpecName, endpoint) {
  const launchKernel = endpoint ? launchSocketIoKernel : launchZmqKernel
  return (subject) => {
    launchKernel(kernelSpecName, endpoint)
      .then(kc => {
        const { channels, connectionFile, spawn } = kc;
        subject.next({
          type: NEW_KERNEL,
          channels,
          connectionFile,
          spawn,
        });
      })
      .catch((err) => console.error(err));
  };
}

export function save() {
  return (subject, dispatch, state) => {
    subject.next({
      type: START_SAVING,
    });

    writeFile(state.filename, JSON.stringify(commutable.toJS(state.notebook), null, 2), (err) => {
      if(err) {
        console.error(err);
        throw err;
      }
      subject.next({
        type: DONE_SAVING,
      });
    });

  };
}

export function saveAs(filename) {
  return (subject, dispatch) => {
    subject.next({
      type: CHANGE_FILENAME,
      filename,
    });
    dispatch(save());
  };
}

// TODO: better kernel selection and multiple enchannel backends
function selectKernel(endpoint) {
  const listKernels = (endpoint) ? listSocketIoKernelSpecs : listZmqKernelSpecs
  return listKernels(endpoint)
    .then((kernels) => {
      return Object.keys(kernels)[0]
    })
}

export function readNotebook(filePath, endpoint) {
  return (subject) => {
    getJSON(filePath)
      .then((data) => {
        subject.next({
          type: READ_NOTEBOOK,
          data,
        });
        selectKernel(endpoint)
          .then((kernel) => {
            console.log('chose kernel: ' + kernel)
            newKernel(kernel, endpoint)(subject)
          })
      });
  };
}

export function setSelected(ids, additive) {
  return {
    type: SET_SELECTED,
    ids,
    additive,
  };
}

export function updateCellSource(id, source) {
  return {
    type: UPDATE_CELL_SOURCE,
    id,
    source,
  };
}

export function updateCellOutputs(id, outputs) {
  return {
    type: UPDATE_CELL_OUTPUTS,
    id,
    outputs,
  };
}

export function moveCell(id, destinationId, above) {
  return {
    type: MOVE_CELL,
    id,
    destinationId,
    above,
  };
}

export function removeCell(id) {
  return {
    type: REMOVE_CELL,
    id,
  };
}

export function createCellAfter(cellType, id) {
  return {
    type: NEW_CELL_AFTER,
    cellType,
    id,
  };
}

export function updateCellExecutionCount(id, count) {
  return {
    type: UPDATE_CELL_EXECUTION_COUNT,
    id,
    count,
  };
}

export function executeCell(id, source) {
  return (subject, dispatch, state) => {
    const { iopub, shell } = state.channels;

    if(!iopub || !shell) {
      subject.next({ type: ERROR_KERNEL_NOT_CONNECTED });
      return;
    }

    const executeRequest = createExecuteRequest(source);

    // Limitation of the Subject implementation in enchannel
    // we must shell.subscribe in order to shell.next
    shell.subscribe(() => {});

    // Set the current outputs to an empty list
    dispatch(updateCellOutputs(id, new Immutable.List()));

    iopub.__proto__.childOf = childOf
    const childMessages = iopub.childOf(executeRequest)
                               .share();

    childMessages.ofMessageType(['execute_input'])
                 .pluck('content', 'execution_count')
                 .first()
                 .subscribe((ct) => {
                   dispatch(updateCellExecutionCount(id, ct));
                 });

    // Handle all the nbformattable messages
    childMessages
         .ofMessageType(['execute_result', 'display_data', 'stream', 'error', 'clear_output'])
         .map(msgSpecToNotebookFormat)
         // Iteratively reduce on the outputs
         .scan((outputs, output) => {
           if(output.output_type === 'clear_output') {
             return new Immutable.List();
           }
           return outputs.push(Immutable.fromJS(output));
         }, new Immutable.List())
         // Update the outputs with each change
         .subscribe(outputs => {
           dispatch(updateCellOutputs(id, outputs));
         });

    shell.next(executeRequest);
  };
}
