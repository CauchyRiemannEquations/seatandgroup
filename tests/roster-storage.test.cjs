const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = new vm.Script(readFileSync(join(__dirname, '../app.js'), 'utf8'));
const classKey = 'seat_arranger_classes_package';
const quickKey = 'seat_arranger_quick_roster';
const activeKey = 'seat_arranger_active_class_name';

function openStorage(saved = {}) {
  const items = new Map(Object.entries(saved));
  const elements = new Map();
  const eventTarget = { addEventListener() {} };
  const document = {
    ...eventTarget,
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, { ...eventTarget, value: '' });
      return elements.get(id);
    },
    querySelectorAll: () => []
  };
  const localStorage = {
    getItem: key => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: key => items.delete(key)
  };
  const context = vm.createContext({ document, window: eventTarget, localStorage });
  source.runInContext(context);
  context.initClasses();
  return { items, context, state: vm.runInContext('state', context), roster: elements.get('student-list') };
}

test('a fresh roster can persist without creating a named class', () => {
  const app = openStorage();
  assert.equal(app.state.activeClass, '');
  assert.equal(Object.keys(app.state.classes).length, 0);
  app.roster.value = '가람\n나은';
  app.state.frontRows = 2;
  app.state.frontStudentsText = '나은';
  app.context.saveClassesToStorage();
  const draft = JSON.parse(app.items.get(quickKey));
  assert.equal(draft.studentsText, '가람\n나은');
  assert.equal(draft.frontRows, 2);
  assert.equal(draft.frontStudentsText, '나은');
  assert.deepEqual(Object.keys(JSON.parse(app.items.get(classKey) || '{}')), []);
  assert.equal(openStorage(Object.fromEntries(app.items)).state.activeClass, '');
});

test('restores a legacy named class and preserves its serialized constraints when saving a quick draft', () => {
  const record = {
    studentsText: '루리\n마루', rows: 3, cols: 4, disabledSeats: [3],
    locks: [[2, '루리']], separatedPairs: [['루리', '마루']],
    lastAssignment: [], lastGroupAssignment: [], lastPickerAssignment: ['마루'],
    frontRows: 2, frontStudentsText: '마루'
  };
  const saved = { [activeKey]: '기하', [classKey]: JSON.stringify({ 기하: record }) };
  const named = openStorage(saved);
  assert.equal(named.state.activeClass, '기하');
  const quick = openStorage({ ...saved, [activeKey]: '' });
  assert.equal(quick.state.activeClass, '');
  quick.roster.value = '별도 명단';
  quick.context.saveClassesToStorage();
  const classes = JSON.parse(quick.items.get(classKey));
  for (const [key, value] of Object.entries(record)) assert.deepEqual(classes['기하'][key], value);
  assert.equal(JSON.parse(quick.items.get(quickKey)).studentsText, '별도 명단');
});
