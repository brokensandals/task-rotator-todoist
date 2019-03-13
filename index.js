const axios = require('axios');
const uuidv4 = require('uuid/v4');

async function getTaskCompletions(token) {
  const url = 'https://todoist.com/api/v7/activity/get';
  const params = {token: token};

  const response = await axios.post(url, params);
  if (response.status != 200) {
    console.log('Unexpected response when retrieving activity: ' + response);
    throw 'Unable to retrieve activity';
  }

  const result = [];
  const idsSeen = new Set();
  response.data.forEach(entry => {
    if (entry.object_type != 'item' || entry.event_type != 'completed' || idsSeen.has(entry.object_id)) {
      return;
    }
    idsSeen.add(entry.object_id);

    if (!entry.extra_data || !entry.extra_data.content) {
      return;
    }

    result.push({id: entry.object_id, content: entry.extra_data.content});
  });

  return result;
}

async function getTasksById(token) {
  const url = 'https://todoist.com/api/v7/sync';
  const params = {token: token, sync_token: '*', resource_types: '["items"]'};

  const response = await axios.post(url, params);
  if (response.status != 200) {
    console.log('Unexpected response when retrieving items: ' + response);
    throw 'Unable to retrieve items';
  }

  const tasksById = {};
  response.data.items.forEach(item => {
    tasksById[item.id] = item;
  });

  return tasksById;
}

async function getTaskRotationNotes(token) {
  const url = 'https://todoist.com/api/v7/sync';
  const params = {token: token, sync_token: '*', resource_types: '["notes"]'};

  const response = await axios.post(url, params);
  if (response.status != 200) {
    console.log('Unexpected response when retrieving notes: ' + response);
    throw 'Unable to retrieve notes';
  }

  const rotationNotesByTaskId = {};
  response.data.notes.forEach(note => {
    if (note.is_deleted || note.is_archived) {
      return;
    }

    if (note.content.startsWith('ROTATION:\n')) {
      rotationNotesByTaskId[note.item_id] = note;
    }
  });

  return rotationNotesByTaskId;
}

async function writeUpdates(token, commands) {
  if (commands.length < 1) {
    return;
  }

  const url = 'https://todoist.com/api/v7/sync';
  const params = {token: token, sync_token: '*', commands: JSON.stringify(commands)};

  const response = await axios.post(url, params);
  if (response.status != 200) {
    console.log('Unexpected response when writing updates: ' + response);
    throw 'Unable to write updates';
  }

  const statuses = response.data.sync_status;
  Object.keys(statuses).forEach(uuid => {
    const status = statuses[uuid];
    if (status != 'ok') {
      console.log('An update failed: ' + status);
    }
  });
}

function filterTasksChangedSinceCompletion(taskCompletions, tasksById) {
  return taskCompletions.filter(({id, content}) => {
    const task = tasksById[id];
    if (!task) {
      console.log('Found activity for ' + id + ' but no task with that ID');
      return false;
    }

    if (task.content != content) {
      console.log('Task ' + id + ' has had its content changed from [' + content + '] to [' + task.content + '] since it was completed.');
      return false;
    }

    return true;
  });
}

function parseRotationNote(note) {
  let lines = note.content.split("\n");
  if (lines[0] != 'ROTATION:') {
    console.log('Cannot parse rotation note, does not contain correct start line: ' + note);
    return null;
  }
  lines.shift();

  lines.map(line => line.trim()).filter(line => !!line);
  if (lines.length < 1) {
    console.log('Cannot parse rotation note, does not contain any entries: ' + note);
    return null;
  }

  return lines;
}

function getNextTaskContent(lastContent, rotation) {
  const nextIndex = rotation.indexOf(lastContent) + 1;
  if (!nextIndex) {
    console.log('Cannot find most recent content [' + lastContent + '] in rotation [' + rotation + ']');
    return null;
  }

  if (nextIndex == rotation.length) {
    return rotation[0];
  }
  return rotation[nextIndex];
}

function buildTaskUpdates(taskCompletions, taskRotationNotes) {
  return taskCompletions.map(({id, content}) => {
    const note = taskRotationNotes[id];
    if (!note) {
      return null;
    }

    const rotation = parseRotationNote(note);
    if (!note) {
      return null;
    }

    const nextContent = getNextTaskContent(content, rotation);
    if (!nextContent) {
      return null;
    }

    return ({id: id, content: nextContent});
  }).filter(update => !!update);
}

function buildTaskUpdateCommands(taskUpdates) {
  return taskUpdates.map(({id, content}) => ({
    type: 'item_update',
    uuid: uuidv4(),
    args: { id, content }
  }));
}

module.exports = async () => {
  const token = process.env.TODOIST_API_TOKEN;
  if (!token) {
    throw 'Environment variable TODOIST_API_TOKEN not set';
  }
  
  const taskCompletions = await getTaskCompletions(token);
  const tasksById = await getTasksById(token);
  const filteredCompletions = filterTasksChangedSinceCompletion(taskCompletions, tasksById);
  const taskRotationNotes = await getTaskRotationNotes(token);
  const taskUpdates = buildTaskUpdates(filteredCompletions, taskRotationNotes);

  if (taskUpdates.length > 0) {
    console.log('Will perform updates:');
    console.log(taskUpdates);
    const taskUpdateCommands = buildTaskUpdateCommands(taskUpdates);
    writeUpdates(token, taskUpdateCommands);
  }
}
