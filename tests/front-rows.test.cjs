const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const appScript = new vm.Script(readFileSync(join(__dirname, '../app.js'), 'utf8'));
const students = ['가람', '나은', 'Da Yeon', '라온', '마루', '보람', '사랑', '아라'];

function classroom(options = {}) {
  // The solver needs no DOM. Let the browser entry point register its handlers without running init.
  const element = { addEventListener() {} };
  const document = { ...element, getElementById: () => element, querySelectorAll: () => [] };
  let seed = 478523;
  const math = Object.create(Math);
  math.random = () => {
    seed = (1664525 * seed + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
  const context = vm.createContext({ document, window: element, Math: math });
  appScript.runInContext(context);
  const state = vm.runInContext('state', context);
  Object.assign(state, { rows: 3, cols: 4, students: [...students] }, options);
  return () => context.solveSeatingAssignment(context.getActiveSeatIndices());
}

function assertRoster(assignment, roster = students) {
  const occupants = Array.from(assignment).filter(name => name !== null && name !== '빈자리');
  assert.deepEqual(occupants.sort(), [...roster].sort());
}

for (const frontRows of [1, 2]) {
  test(`front ${frontRows} row(s) randomize independently of viewing direction`, () => {
    const draw = classroom({
      frontRows, frontStudentsText: ' 가람, Da Yeon\n가람 ',
      disabledSeats: new Set([1]), isFlippedView: true
    });
    const reachedSeats = new Set();
    for (let i = 0; i < 80; i++) {
      const { success, assignment } = draw();
      assert.ok(success);
      assertRoster(assignment);
      assert.equal(assignment[1], null);
      for (const name of ['가람', 'Da Yeon']) {
        assert.ok(assignment.indexOf(name) < frontRows * 4);
      }
      reachedSeats.add(assignment.indexOf('가람'));
    }
    assert.equal(reachedSeats.size, frontRows * 4 - 1);
  });
}

test('accepts compatible locks and keeps separated students apart', () => {
  const draw = classroom({
    frontStudentsText: '가람, 나은', locks: new Map([[2, '나은'], [11, '보람']]),
    separatedPairs: [['가람', '라온']]
  });
  for (let i = 0; i < 50; i++) {
    const { success, assignment } = draw();
    assert.ok(success);
    assertRoster(assignment);
    assert.equal(assignment[2], '나은');
    assert.equal(assignment[11], '보람');
    const a = assignment.indexOf('가람');
    const b = assignment.indexOf('라온');
    assert.ok(a < 4);
    assert.ok(Math.abs(a % 4 - b % 4) > 1 || Math.abs(Math.floor(a / 4) - Math.floor(b / 4)) > 1);
  }
});

const impossible = {
  'unknown name': { frontStudentsText: '명단 밖' },
  'ambiguous name': { frontStudentsText: '가람', students: [...students, '가람'] },
  'not enough front seats': { frontStudentsText: '가람, 나은', disabledSeats: new Set([1, 2, 3]) },
  'preferred student locked at the back': { frontStudentsText: '가람', locks: new Map([[11, '가람']]) },
  'front seats occupied by other students': {
    frontStudentsText: '가람, 나은', disabledSeats: new Set([1, 2]), locks: new Map([[0, '라온']])
  },
  'adjacent locks for separated students': {
    frontStudentsText: '나은', locks: new Map([[0, '가람'], [1, '나은']]), separatedPairs: [['가람', '나은']]
  }
};
for (const [reason, options] of Object.entries(impossible)) {
  test(`refuses an invalid draw: ${reason}`, () => {
    const result = classroom(options)();
    assert.equal(result.success, false);
    assert.ok(result.error);
    assert.equal(result.assignment, undefined);
  });
}

test('empty preferences use the whole room and preserve duplicate roster entries', () => {
  const roster = [...students, '가람'];
  const draw = classroom({ students: roster, locks: new Map([[0, '가람']]) });
  const rows = new Set();
  for (let i = 0; i < 40; i++) {
    const { success, assignment } = draw();
    assert.ok(success);
    assertRoster(assignment, roster);
    rows.add(Math.floor(assignment.indexOf('나은') / 4));
  }
  assert.equal(rows.size, 3);
});

test('public fixed seats take priority at both ends of a conflicting private assignment', () => {
  const locks = new Map([[0, '가람'], [7, '나은'], [10, 'Da Yeon']]);
  const publicLocks = new Map([[0, '나은']]);
  const draw = classroom({ locks, publicLocks });
  for (let i = 0; i < 60; i++) {
    const { success, assignment } = draw();
    assert.ok(success);
    assertRoster(assignment);
    assert.equal(assignment[0], '나은');
    assert.equal(assignment[10], 'Da Yeon');
  }
  publicLocks.clear();
  const { assignment } = draw();
  assert.equal(assignment[0], '가람');
  assert.equal(assignment[7], '나은');
  assert.equal(assignment[10], 'Da Yeon');
});

test('a public seat must satisfy front-row and separation constraints', () => {
  const publicLocks = new Map([[2, '나은']]);
  const draw = classroom({
    publicLocks, frontStudentsText: '나은, 가람', disabledSeats: new Set([1]),
    separatedPairs: [['나은', '보람']]
  });
  for (let i = 0; i < 40; i++) {
    const { success, assignment } = draw();
    assert.ok(success);
    assertRoster(assignment);
    assert.equal(assignment[2], '나은');
    assert.ok([0, 3].includes(assignment.indexOf('가람')));
    assert.ok([0, 4, 8, 9, 10, 11].includes(assignment.indexOf('보람')));
  }
  publicLocks.set(3, '보람');
  assert.equal(draw().success, false);
  publicLocks.delete(3);
  publicLocks.set(11, '가람');
  assert.equal(draw().success, false);
});
