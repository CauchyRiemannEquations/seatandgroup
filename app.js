/* ==========================================
   스마트 클래스 자리배치 & 모둠기 - app.js
   Full Integration of Seating, Group Maker, Themes, and Class Groups
   ========================================== */

// 1. 애플리케이션 상태 관리 객체 (State)
const state = {
  // 학급 목록 (Map형식의 Object: { '학급명': { studentsText, disabledSeats, locks, separatedPairs, lastAssignment, lastGroupAssignment, rows, cols } })
  classes: Object.create(null),
  quickRoster: {},
  activeClass: '', // 빈 문자열은 학급을 선택하지 않은 바로 사용 명단
  
  // 현재 학급의 바인딩된 상태 변수들
  rows: 5,
  cols: 6,
  students: [],
  frontRows: 1,
  frontStudentsText: '',
  disabledSeats: new Set(),
  publicLocks: new Map(), // 공개 지정석
  locks: new Map(), // 비밀 고정석
  separatedPairs: [], // [[s1, s2], ...]
  assignment: [], // 직전 자리 배치
  lastGroupAssignment: [], // 직전 소그룹 조 편성 [[s1, s2, ...], [s3, s4, ...]]
  
  // 소그룹 설정
  targetGroupSize: 4,
  useSepForGroups: true, // 기피 분리 규칙 항상 적용

  // 랜덤 뽑기 설정
  targetPickerCount: 1,
  lastPickerAssignment: [],
  
  // 테마 및 탭 상태
  theme: 'light', // 'dark' | 'light'
  activeTab: 'seating', // 'seating' | 'groups' | 'picker'
  
  // 교탁 시점 보기 상태 (false: 뒤에서 교탁을 바라본 기본 배치 / true: 교탁에서 학생들을 바라본 180도 회전 배치)
  isFlippedView: false,

  // 보안 모드 상태
  isSecretUnlocked: false,
  lockSelectingStudent: null, // 고정 대기 학생
  hideLocksOnBoard: true,
  
  // 애니메이션 관리
  isShuffling: false,
  shuffleInterval: null
};

// 2. DOM 요소 참조
const DOM = {
  // 테마 토글
  btnThemeToggle: document.getElementById('btn-theme-toggle'),
  
  // 학급 관리
  classSelect: document.getElementById('class-select'),
  savedClassControls: document.getElementById('saved-class-controls'),
  rosterLabel: document.getElementById('roster-label'),
  btnQuickRoster: document.getElementById('btn-quick-roster'),
  btnCreateClass: document.getElementById('btn-create-class'),
  classDialog: document.getElementById('create-class-dialog'),
  classForm: document.getElementById('create-class-form'),
  classFormError: document.getElementById('class-form-error'),
  newClassStudents: document.getElementById('new-class-students'),
  btnCancelClass: document.getElementById('btn-cancel-class'),
  btnDeleteClass: document.getElementById('btn-delete-class'),
  newClassName: document.getElementById('new-class-name'),
  
  // 학생 명단 및 레이아웃 설정
  studentList: document.getElementById('student-list'),
  studentCount: document.getElementById('student-count'),
  frontRowSettings: document.getElementById('front-row-settings'),
  frontRowInputs: document.querySelectorAll('input[name="front-rows"]'),
  frontStudents: document.getElementById('front-students'),
  frontStudentAdd: document.getElementById('front-student-add'),
  frontRowStatus: document.getElementById('front-row-status'),
  gridRows: document.getElementById('grid-rows'),
  gridCols: document.getElementById('grid-cols'),
  gridSteps: document.querySelectorAll('[data-grid-step]'),
  rowsVal: document.getElementById('rows-val'),
  colsVal: document.getElementById('cols-val'),
  preset6x5: document.getElementById('preset-6x5'),
  preset5x6: document.getElementById('preset-5x6'),
  presetPairs: document.getElementById('preset-pairs'),
  presetUShape: document.getElementById('preset-u-shape'),
  btnResetLayout: document.getElementById('btn-reset-layout'),
  btnFlipView: document.getElementById('btn-flip-view'),
  sidebarLayoutSettings: document.getElementById('sidebar-layout-settings'),
  appTitleTrigger: document.getElementById('app-title-trigger'),
  
  // 메인 탭바 및 뷰
  tabBtnSeating: document.getElementById('tab-btn-seating'),
  tabBtnGroups: document.getElementById('tab-btn-groups'),
  tabBtnPicker: document.getElementById('tab-btn-picker'),
  viewSeating: document.getElementById('view-seating'),
  viewGroups: document.getElementById('view-groups'),
  viewPicker: document.getElementById('view-picker'),
  
  // 1) 자리배치 캔버스 영역
  seatsGrid: document.getElementById('seats-grid'),
  mapDimensions: document.getElementById('map-dimensions'),
  classroomCanvas: document.getElementById('classroom-canvas'),
  btnShuffle: document.getElementById('btn-shuffle'),
  btnSaveStudent: document.getElementById('btn-save-student'),
  btnSaveTeacher: document.getElementById('btn-save-teacher'),
  saveMenuStudent: document.getElementById('save-menu-student'),
  saveMenuTeacher: document.getElementById('save-menu-teacher'),
  seatStatusBadge: document.getElementById('seat-status-badge'),
  diffStatusBadge: document.getElementById('diff-status-badge'),
  
  // 2) 조 짜기 캔버스 영역
  groupSize: document.getElementById('group-size'),
  groupSizeVal: document.getElementById('group-size-val'),
  groupsBoard: document.getElementById('groups-board'),
  groupCanvas: document.getElementById('group-canvas'),
  btnGroupShuffle: document.getElementById('btn-group-shuffle'),
  btnGroupSaveImage: document.getElementById('btn-group-save-image'),
  btnGroupCopyText: document.getElementById('btn-group-copy-text'),

  // 3) 랜덤 뽑기 영역
  pickerCount: document.getElementById('picker-count'),
  pickerCountVal: document.getElementById('picker-count-val'),
  btnPickerStart: document.getElementById('btn-picker-start'),
  pickerBoard: document.getElementById('picker-board'),
  pickerCanvas: document.getElementById('picker-canvas'),
  btnPickerCopyText: document.getElementById('btn-picker-copy-text'),
  
  // 비밀 설정 사이드바 패널
  secretSidebarPanel: document.getElementById('secret-sidebar-panel'),
  sepStudent1: document.getElementById('sep-student-1'),
  sepStudent2: document.getElementById('sep-student-2'),
  btnAddSep: document.getElementById('btn-add-sep'),
  sepsCount: document.getElementById('seps-count'),
  sepsListUl: document.getElementById('seps-list-ul'),
  toastContainer: document.getElementById('toast-container')
};

// 3. Web Audio API 오디오 합성기 (Retro Chime)
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playTickSound() {
  try {
    initAudio();
    if (!audioCtx || audioCtx.state === 'suspended') return;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140 + Math.random() * 60, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.08);
    
    gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.08);
  } catch (e) {}
}

function playSuccessSound() {
  try {
    initAudio();
    if (!audioCtx || audioCtx.state === 'suspended') return;
    
    const now = audioCtx.currentTime;
    
    // 1st note (도)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);
    
    // 2nd note (미)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.12);
    gain2.gain.setValueAtTime(0.08, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.35);
  } catch (e) {}
}

// 4. 알림 토스트 팝업
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = '';
  if (type === 'success') {
    icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:1.1rem;height:1.1rem;"><polyline points="20 6 9 17 4 12"/></svg>';
  } else if (type === 'warning') {
    icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:1.1rem;height:1.1rem;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>';
  } else if (type === 'danger') {
    icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:1.1rem;height:1.1rem;"><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>';
  }
  
  toast.innerHTML = icon;
  const messageText = document.createElement('span');
  messageText.textContent = message;
  toast.appendChild(messageText);
  DOM.toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

const usageHelp = document.getElementById('usage-help-dialog');
document.getElementById('btn-open-help').addEventListener('click', () => {
  usageHelp.showModal();
});
document.getElementById('btn-close-help').addEventListener('click', () => {
  usageHelp.close();
});

// 5. 학급(그룹) 관리 로직
const CLASSES_KEY = 'seat_arranger_classes_package';
const QUICK_ROSTER_KEY = 'seat_arranger_quick_roster';
const ACTIVE_CLASS_KEY = 'seat_arranger_active_class_name';

function readStoredRecord(key) {
  const raw = localStorage.getItem(key);
  if (raw === null) return Object.create(null);
  try {
    const record = JSON.parse(raw);
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Invalid saved roster');
    return Object.assign(Object.create(null), record);
  } catch (error) {
    // Keep the exact old bytes before making a fresh workspace available.
    localStorage.setItem(`${key}_recovery_${Date.now()}`, raw);
    localStorage.removeItem(key);
    console.warn('Could not parse saved roster', error);
    showToast('이전 명단의 저장 형식을 읽을 수 없어 원본을 백업했습니다.', 'warning');
    return Object.create(null);
  }
}

function saveClassesToStorage() {
  const current = {
    studentsText: DOM.studentList.value,
    frontRows: state.frontRows,
    frontStudentsText: state.frontStudentsText,
    disabledSeats: [...state.disabledSeats],
    publicLocks: [...state.publicLocks],
    locks: [...state.locks],
    separatedPairs: state.separatedPairs,
    lastAssignment: state.assignment,
    lastGroupAssignment: state.lastGroupAssignment,
    lastPickerAssignment: state.lastPickerAssignment,
    targetGroupSize: state.targetGroupSize,
    targetPickerCount: state.targetPickerCount,
    rows: state.rows,
    cols: state.cols
  };
  try {
    if (state.activeClass) {
      // Merge this class only, keeping other classes edited in another tab.
      state.classes[state.activeClass] = current;
      const classes = readStoredRecord(CLASSES_KEY);
      if (!Object.hasOwn(classes, state.activeClass)) return;
      classes[state.activeClass] = current;
      localStorage.setItem(CLASSES_KEY, JSON.stringify(classes));
      state.classes = classes;
    } else {
      state.quickRoster = current;
      readStoredRecord(QUICK_ROSTER_KEY);
      localStorage.setItem(QUICK_ROSTER_KEY, JSON.stringify(current));
    }
  } catch (error) {
    console.error(error);
    showToast('명단 변경 사항을 저장할 수 없습니다. 브라우저 저장 공간을 확인해 주세요.', 'warning');
  }
}

function loadClassData(className) {
  const cl = className ? state.classes[className] : state.quickRoster;
  if (!cl) return;
  state.activeClass = className;
  const classBadge = document.getElementById('workspace-class');
  classBadge.textContent = className;
  classBadge.hidden = !className;

  // 상태 변수 매핑
  state.rows = cl.rows || 5;
  state.cols = cl.cols || 6;
  state.frontRows = cl.frontRows === 2 ? 2 : 1;
  state.frontStudentsText = cl.frontStudentsText || '';
  state.disabledSeats = new Set(cl.disabledSeats || []);
  state.publicLocks = new Map(cl.publicLocks || []);
  state.locks = new Map(cl.locks || []);
  state.separatedPairs = cl.separatedPairs || [];
  state.assignment = cl.lastAssignment || [];
  state.lastGroupAssignment = cl.lastGroupAssignment || [];
  state.lastPickerAssignment = cl.lastPickerAssignment || [];
  state.targetGroupSize = cl.targetGroupSize || 4;
  state.targetPickerCount = cl.targetPickerCount || 1;
  DOM.groupSize.value = state.targetGroupSize;
  DOM.groupSizeVal.textContent = state.targetGroupSize;
  
  // UI 바인딩
  DOM.studentList.value = cl.studentsText || '';
  DOM.frontStudents.value = state.frontStudentsText;
  DOM.frontRowInputs.forEach(input => { input.checked = Number(input.value) === state.frontRows; });
  DOM.gridRows.value = state.rows;
  DOM.gridCols.value = state.cols;
  DOM.rowsVal.textContent = state.rows;
  DOM.colsVal.textContent = state.cols;
  
  // 파싱
  parseStudents(false); // 로컬 저장 억제 플래그 추가
  
  // 그리드 재구성 및 조 캔버스 갱신
  buildGrid();
  renderGroupsList();
  renderPickerList();
  
  // 드롭다운 업데이트
  DOM.classSelect.value = className;
  DOM.btnQuickRoster.setAttribute('aria-pressed', String(!className));
  DOM.btnDeleteClass.hidden = !className;
  DOM.rosterLabel.textContent = className ? `${className} 학생 명단` : '학생 명단';
  
  updateSeparationsList();
}

// 드롭다운 채우기
function populateClassSelectDropdown() {
  DOM.classSelect.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '학급 선택';
  placeholder.disabled = true;
  DOM.classSelect.appendChild(placeholder);
  const names = Object.keys(state.classes);
  DOM.savedClassControls.hidden = names.length === 0;
  for (const name of names) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    DOM.classSelect.appendChild(opt);
  }
  
  DOM.classSelect.value = state.activeClass;
}

function splitStudentNames(text) {
  return text
    .split(/[\n,]+/)
    .map(name => name.trim())
    .filter(name => name.length > 0);
}

// 이름표 템플릿에서도 번호나 기호가 포함된 명단을 입력한 그대로 표시한다.
function nameAsHtmlText(name) {
  return name.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

// 학생 리스트 파싱
function parseStudents(shouldSave = true) {
  const names = splitStudentNames(DOM.studentList.value);
  const changed = names.length !== state.students.length || names.some((name, i) => name !== state.students[i]);
  state.students = names;
  for (const [index, name] of state.publicLocks) {
    if (!names.includes(name) || names.indexOf(name) !== names.lastIndexOf(name)) state.publicLocks.delete(index);
  }
  
  DOM.studentCount.textContent = state.students.length;
  refreshFrontStudentOptions();
  document.getElementById('workspace-roster-summary').textContent = names.length
    ? `학생 ${names.length}명` : '학생 명단을 입력해 주세요.';
  
  // 랜덤 뽑기 슬라이더 동적 최댓값 한계 조절
  const studentCount = state.students.length;
  if (DOM.pickerCount) {
    DOM.pickerCount.max = studentCount || 1;
    if (state.targetPickerCount > studentCount) {
      state.targetPickerCount = Math.max(1, studentCount);
    }
    DOM.pickerCount.value = state.targetPickerCount;
    DOM.pickerCountVal.textContent = state.targetPickerCount;
  }
  
  updateStatusIndicators();
  updateModalStudentSelects();
  
  if (shouldSave) {
    if (changed) {
      state.assignment = [];
      state.lastGroupAssignment = [];
      state.lastPickerAssignment = [];
      buildGrid();
      renderGroupsList();
      renderPickerList();
      updateSeparationsList();
    }
    saveClassesToStorage();
  }
}

function getActiveSeatIndices() {
  const seats = [];
  for (let i = 0; i < state.rows * state.cols; i++) {
    if (!state.disabledSeats.has(i)) seats.push(i);
  }
  return seats;
}

// 앞줄은 화면 방향과 관계없이 교탁에 가까운 물리적인 행으로 센다.
function getSeatingPlan(activeSeats) {
  const frontNames = new Set(splitStudentNames(state.frontStudentsText));
  const frontLimit = state.frontRows * state.cols;
  const frontCapacity = activeSeats.filter(index => index < frontLimit).length;
  const freeStudents = [...state.students];
  const lockedSeats = new Map();
  // 공개 지정이 겹치는 비밀 고정석은 이번 배치에서만 제외한다.
  for (const pins of [state.publicLocks, state.locks]) {
    for (const index of activeSeats) {
      if (!pins.has(index) || lockedSeats.has(index)) continue;
      const name = pins.get(index);
      const studentIndex = freeStudents.indexOf(name);
      if (studentIndex < 0) continue;
      lockedSeats.set(index, name);
      freeStudents.splice(studentIndex, 1);
    }
  }
  const freeSeats = activeSeats.filter(index => !lockedSeats.has(index));
  const freeFrontSeats = freeSeats.filter(index => index < frontLimit);
  const frontStudents = freeStudents.filter(name => frontNames.has(name));
  const remainingStudents = freeStudents.filter(name => !frontNames.has(name));
  const unknown = [...frontNames].filter(name => !state.students.includes(name));
  const ambiguous = [...frontNames].filter(name => state.students.indexOf(name) !== state.students.lastIndexOf(name));
  let error = '';
  if (unknown.length) {
    error = `학급 명단에 없는 이름을 확인하세요. ${unknown.join(', ')}`;
  } else if (ambiguous.length) {
    error = `동명이인은 두 명단에 번호를 붙여 구분하세요. ${ambiguous.join(', ')}`;
  } else if (frontNames.size > frontCapacity) {
    error = `앞자리 ${frontNames.size - frontCapacity}석이 부족합니다. 앞줄 범위나 희망자 명단을 조정하세요.`;
  } else if ([...state.publicLocks].some(([index, name]) => index >= frontLimit && frontNames.has(name))) {
    error = '앞자리 희망 학생의 지정석이 앞줄 밖에 있습니다. 좌석 지정이나 앞자리 범위를 바꿔 주세요.';
  } else if (frontStudents.length > freeFrontSeats.length ||
    [...lockedSeats].some(([index, name]) => index >= frontLimit && frontNames.has(name))) {
    error = state.isSecretUnlocked
      ? '앞자리 희망자와 고정석이 충돌합니다. 고정석 위치나 앞줄 범위를 조정하세요.'
      : '현재 설정으로 희망자를 모두 앞에 배치할 수 없습니다. 앞줄 범위나 배치 설정을 확인하세요.';
  }
  return { lockedSeats, freeSeats, freeFrontSeats, frontStudents, remainingStudents, frontCount: frontNames.size, frontCapacity, error };
}

// 6. 상태 배지 업데이트
function updateStatusIndicators() {
  updateRoomControls();
  const totalSeats = state.rows * state.cols;
  const activeCount = totalSeats - state.disabledSeats.size;
  const plan = getSeatingPlan(getActiveSeatIndices());
  DOM.frontRowStatus.textContent = plan.error || `희망 ${plan.frontCount}명 · 앞자리 ${plan.frontCapacity}석`;
  DOM.frontRowStatus.classList.toggle('has-error', Boolean(plan.error));
  DOM.frontStudents.setAttribute('aria-invalid', String(Boolean(plan.error)));
  
  DOM.seatStatusBadge.textContent = `사용 좌석 ${activeCount}석`;
  
  const studentCount = state.students.length;
  if (studentCount === 0) {
    DOM.diffStatusBadge.textContent = "명단을 입력하세요";
    DOM.diffStatusBadge.className = "status-badge mismatch";
    DOM.btnShuffle.disabled = true;
    DOM.btnGroupShuffle.disabled = true;
    DOM.btnPickerStart.disabled = true;
  } else if (studentCount > activeCount) {
    DOM.diffStatusBadge.textContent = `좌석 ${studentCount - activeCount}석 부족`;
    DOM.diffStatusBadge.className = "status-badge mismatch";
    DOM.btnShuffle.disabled = true;
    DOM.btnGroupShuffle.disabled = false; // 조짜기는 자리 제약 무관
    DOM.btnPickerStart.disabled = false;
  } else {
    const emptyCount = activeCount - studentCount;
    DOM.diffStatusBadge.textContent = plan.error ? '앞자리 설정 확인' : `빈자리 ${emptyCount}석`;
    DOM.diffStatusBadge.className = plan.error ? 'status-badge mismatch' : 'status-badge match';
    DOM.btnShuffle.disabled = Boolean(plan.error) || state.isShuffling;
    DOM.btnGroupShuffle.disabled = false;
    DOM.btnPickerStart.disabled = false;
  }
}

function refreshFrontStudentOptions() {
  const select = DOM.frontStudentAdd;
  const selected = new Set(splitStudentNames(state.frontStudentsText));
  select.replaceChildren(new Option('명단에서 추가', ''));
  for (const { name, label, disabled } of publicStudentChoices()) {
    const option = new Option(label, name);
    option.disabled = disabled || selected.has(name);
    select.add(option);
  }
  select.hidden = state.students.length === 0;
}

DOM.frontStudentAdd.addEventListener('change', () => {
  if (!DOM.frontStudentAdd.value) return;
  const names = splitStudentNames(DOM.frontStudents.value);
  DOM.frontStudents.value = [...names, DOM.frontStudentAdd.value].join(', ');
  updateFrontPreferences();
});

function updateFrontPreferences() {
  state.frontStudentsText = DOM.frontStudents.value;
  const selected = [...DOM.frontRowInputs].find(input => input.checked);
  state.frontRows = Number(selected.value);
  refreshFrontStudentOptions();
  buildGrid();
  saveClassesToStorage();
}

DOM.frontStudents.addEventListener('input', updateFrontPreferences);
DOM.frontRowInputs.forEach(input => input.addEventListener('change', updateFrontPreferences));

// 7. 좌석 그리드 빌더
// 교탁 시점 모드 시 캔버스 요소 순서(교탁/그리드/뒤쪽 표시)를 물리적으로 재배열
// (html2canvas 캡처 호환을 위해 CSS 반전 대신 DOM 순서를 직접 조정)
function applyFlippedLayout() {
  const canvas = DOM.classroomCanvas;
  const front = canvas.querySelector('.classroom-front');
  const back = canvas.querySelector('.classroom-back');
  if (!front || !back) return;

  if (state.isFlippedView) {
    canvas.insertBefore(back, canvas.firstChild); // 뒤 쪽 표시를 맨 위로
    canvas.appendChild(front);                    // 교탁(앞 쪽)을 맨 아래로
  } else {
    canvas.insertBefore(front, canvas.firstChild);
    canvas.appendChild(back);
  }

  canvas.classList.toggle('flipped-view', state.isFlippedView);
  if (DOM.btnFlipView) {
    DOM.btnFlipView.classList.toggle('toggled-on', state.isFlippedView);
    DOM.btnFlipView.setAttribute('aria-pressed', String(state.isFlippedView));
  }
}

function buildGrid() {
  closeInlineSeatPicker();
  cancelPendingSeatClick();
  const container = DOM.seatsGrid;
  DOM.classroomCanvas.style.setProperty('--seat-columns', state.cols);
  container.innerHTML = '';
  container.style.gridTemplateColumns = `repeat(${state.cols}, 1fr)`;

  const totalSeats = state.rows * state.cols;
  const publicNames = new Set(state.publicLocks.values());
  const capturing = document.body.classList.contains('html2canvas-capturing');
  const showSecret = state.isSecretUnlocked && !capturing;
  const frontNames = new Set(splitStudentNames(state.frontStudentsText));
  DOM.mapDimensions.textContent = `(${state.rows}행 × ${state.cols}열)`;

  // 표시 순서 계산: 교탁 시점 모드에서는 교탁에서 학생들을 바라본 모습이 되도록
  // 행(줄)과 열을 모두 뒤집어 180도 회전된 배치로 그림
  const displayOrder = [];
  for (let r = 0; r < state.rows; r++) {
    const sourceRow = state.isFlippedView ? (state.rows - 1 - r) : r;
    for (let c = 0; c < state.cols; c++) {
      const sourceCol = state.isFlippedView ? (state.cols - 1 - c) : c;
      displayOrder.push(sourceRow * state.cols + sourceCol);
    }
  }

  for (const i of displayOrder) {
    const row = Math.floor(i / state.cols) + 1;
    const col = (i % state.cols) + 1;
    
    const seat = document.createElement('div');
    seat.className = 'seat-card';
    seat.dataset.index = i;
    
    const isAisle = state.disabledSeats.has(i);
    seat.classList.add(isAisle ? 'disabled' : 'active');
    seat.setAttribute('role', 'button');
    seat.tabIndex = 0;
    if (!state.isSecretUnlocked) {
      seat.setAttribute('aria-haspopup', 'listbox');
      seat.setAttribute('aria-expanded', 'false');
    }

    let label = '통로';
    if (!isAisle) {
      if (frontNames.size && i < state.frontRows * state.cols) seat.classList.add('front-zone');
      const indexLabel = document.createElement('span');
      indexLabel.className = 'seat-index';
      indexLabel.textContent = `${row}-${col}`;
      seat.appendChild(indexLabel);

      const lockedName = state.locks.get(i);
      if (lockedName && !state.students.includes(lockedName)) state.locks.delete(i);
      const publicName = state.publicLocks.get(i);
      const assignedName = state.assignment[i];
      const showPin = showSecret && !publicName && state.locks.has(i) && !publicNames.has(lockedName);
      const isEmpty = assignedName === '빈자리' || assignedName === 'X';
      const hasName = assignedName && state.students.includes(assignedName);
      const occupant = publicName || (showPin ? lockedName : hasName ? assignedName : '');
      const hasPreference = !capturing && frontNames.has(occupant);
      label = occupant || (isEmpty ? '빈자리' : '좌석');
      seat.classList.toggle('assigned', Boolean(occupant || isEmpty));
      seat.classList.toggle('empty-seat', !occupant && isEmpty);
      seat.classList.toggle('public-fixed', Boolean(publicName));
      seat.classList.toggle('front-preferred', hasPreference);
      if (publicName || hasPreference) {
        const mark = document.createElement('span');
        mark.className = publicName ? 'public-seat-badge' : 'front-seat-badge';
        mark.textContent = publicName ? '지정석' : '희망';
        indexLabel.append(' ', mark);
      }
      if (showPin) seat.insertAdjacentHTML('beforeend', getPinSVG());
    }
    const nameLabel = document.createElement('span');
    nameLabel.className = 'student-name';
    nameLabel.textContent = label;
    seat.appendChild(nameLabel);
    const suffix = seat.classList.contains('public-fixed') ? ', 지정석' : seat.classList.contains('front-preferred') ? ', 앞자리 희망' : '';
    seat.setAttribute('aria-label', `${row}줄 ${col}번, ${label}${suffix}`);
    seat.addEventListener('click', event => onSeatClick(event, i));
    seat.addEventListener('dblclick', event => {
      if (state.isSecretUnlocked || state.isShuffling) return;
      event.preventDefault();
      openInlineSeatPicker(i);
    });
    seat.addEventListener('keydown', event => {
      if (state.isShuffling || event.target !== seat || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      if (!state.isSecretUnlocked && event.key === 'Enter') {
        openInlineSeatPicker(i);
      } else {
        handleSeatClick(i);
        if (!state.isSecretUnlocked && !inlineSeatPicker) container.querySelector(`[data-index="${i}"]`)?.focus();
      }
    });
    container.appendChild(seat);
  }

  applyFlippedLayout();

  // 저장 버튼 상태 동기화 (유효한 배치가 있는 경우에만 활성화)
  const hasAssignment = state.assignment && state.assignment.length > 0 && state.assignment.some(name => name && name !== '좌 석' && name !== 'X');
  DOM.btnSaveStudent.disabled = !hasAssignment || state.isShuffling;
  DOM.btnSaveTeacher.disabled = !hasAssignment || state.isShuffling;
  if (!hasAssignment) closeSaveMenus();
  
  updateStatusIndicators();
}

function getPinSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pin-indicator"><line x1="12" x2="12" y1="17" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.5A2 2 0 0 1 15 9.26V5a3 3 0 0 0-6 0v4.26a2 2 0 0 1-.78 1.24l-2.78 3.5a2 2 0 0 0-.44 1.24Z"/></svg>`;
}

// 두 번째 클릭이 도착하기 전에 좌석 DOM을 다시 만들면 브라우저의 더블클릭 대상이 사라진다.
let pendingSeatClick = null;
let inlineSeatPicker = null;

function cancelPendingSeatClick() {
  if (pendingSeatClick) clearTimeout(pendingSeatClick.timer);
  pendingSeatClick = null;
}

function flushPendingSeatClick() {
  if (!pendingSeatClick) return;
  const index = pendingSeatClick.index;
  cancelPendingSeatClick();
  handleSeatClick(index);
}

function onSeatClick(event, index) {
  if (state.isShuffling) return;
  if (state.isSecretUnlocked || state.publicLocks.has(index) || event.detail === 0) {
    handleSeatClick(index);
    return;
  }
  if (event.detail > 1 || pendingSeatClick?.index === index) {
    openInlineSeatPicker(index);
    return;
  }
  // 서로 다른 좌석을 빠르게 눌러도 첫 번째 통로 변경을 잃지 않는다.
  flushPendingSeatClick();
  pendingSeatClick = { index, timer: setTimeout(flushPendingSeatClick, 500) };
}

document.addEventListener('pointerdown', event => {
  if (inlineSeatPicker && !inlineSeatPicker.list.contains(event.target) && !inlineSeatPicker.seat.contains(event.target)) {
    closeInlineSeatPicker();
  }
  if (pendingSeatClick && !event.target.closest('.seat-card')) flushPendingSeatClick();
});

function publicStudentChoices() {
  return [...new Set(state.students)].map(name => {
    const disabled = state.students.indexOf(name) !== state.students.lastIndexOf(name);
    return { name, disabled, label: disabled ? `${name} (동명이인)` : name };
  });
}

function closeInlineSeatPicker() {
  if (!inlineSeatPicker) return;
  const { list, seat } = inlineSeatPicker;
  inlineSeatPicker = null;
  seat.setAttribute('aria-expanded', 'false');
  seat.removeAttribute('aria-controls');
  list.remove();
}

function positionInlineSeatPicker() {
  if (!inlineSeatPicker) return;
  const { seat, list } = inlineSeatPicker;
  const rect = seat.getBoundingClientRect();
  const viewport = seat.closest('.classroom-viewport').getBoundingClientRect();
  const margin = 6;
  const left = Math.max(0, rect.left, viewport.left);
  const right = Math.min(window.innerWidth, rect.right, viewport.right);
  if (right <= left || rect.bottom <= 0 || rect.top >= window.innerHeight) {
    closeInlineSeatPicker();
    return;
  }
  const below = window.innerHeight - rect.bottom - 2 * margin;
  const above = rect.top - 2 * margin;
  const desiredHeight = Math.min(248, list.scrollHeight + 2);
  const opensUp = below < desiredHeight && above > below;
  list.style.maxHeight = Math.max(0, Math.min(248, opensUp ? above : below)) + 'px';
  list.style.left = Math.max(margin, Math.min(left, window.innerWidth - list.offsetWidth - margin)) + 'px';
  list.style.top = (opensUp ? rect.top - margin - list.offsetHeight : rect.bottom + margin) + 'px';
}

function openInlineSeatPicker(index) {
  if (state.isShuffling || state.isSecretUnlocked) return;
  cancelPendingSeatClick();
  const seat = DOM.seatsGrid.querySelector(`[data-index="${index}"]`);
  if (!seat || inlineSeatPicker?.seat === seat) return;
  closeInlineSeatPicker();
  const choices = publicStudentChoices();
  if (!choices.length || choices.every(choice => choice.disabled)) {
    showToast(choices.length ? '동명이인은 명단에 번호를 붙여 구분해 주세요.' : '먼저 학생 명단을 입력해 주세요.', 'warning');
    return;
  }

  const current = state.publicLocks.get(index);
  if (current) choices.push({ name: '', label: '지정 해제', disabled: false });
  const list = document.createElement('div');
  list.id = 'inline-seat-picker';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', `${Math.floor(index / state.cols) + 1}줄 ${index % state.cols + 1}번 학생 선택`);
  for (const { name, label, disabled } of choices) {
    const option = document.createElement('button');
    option.type = 'button';
    option.tabIndex = -1;
    option.disabled = disabled;
    option.value = name;
    option.textContent = label;
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', String(name === current));
    if (!name) option.className = 'release-seat';
    list.appendChild(option);
  }

  list.addEventListener('click', event => {
    const option = event.target.closest('[role="option"]');
    if (!option || option.disabled) return;
    closeInlineSeatPicker();
    savePublicSeat(index, option.value);
    DOM.seatsGrid.querySelector(`[data-index="${index}"]`)?.focus({ preventScroll: true });
  });
  list.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeInlineSeatPicker();
      seat.focus({ preventScroll: true });
      return;
    }
    const options = [...list.querySelectorAll('button:enabled')];
    const active = options.indexOf(document.activeElement);
    let next;
    switch (event.key) {
      case 'ArrowDown': next = (active + 1) % options.length; break;
      case 'ArrowUp': next = (active - 1 + options.length) % options.length; break;
      case 'Home': next = 0; break;
      case 'End': next = options.length - 1; break;
      default: return;
    }
    event.preventDefault();
    options[next].focus();
  });
  list.addEventListener('focusout', event => {
    if (!list.contains(event.relatedTarget)) closeInlineSeatPicker();
  });

  // Keep the list next to its desk in keyboard order and out of the grid layout.
  seat.after(list);
  inlineSeatPicker = { seat, list };
  seat.setAttribute('aria-expanded', 'true');
  seat.setAttribute('aria-controls', list.id);
  positionInlineSeatPicker();
  const initial = list.querySelector('[aria-selected="true"]') || list.querySelector('button:enabled');
  initial.focus({ preventScroll: true });
  list.scrollTop = Math.max(0, initial.offsetTop - list.clientHeight / 2);
}

window.addEventListener('resize', positionInlineSeatPicker);
document.addEventListener('scroll', event => {
  if (inlineSeatPicker && !inlineSeatPicker.list.contains(event.target)) positionInlineSeatPicker();
}, true);

function savePublicSeat(index, name) {
  if (state.publicLocks.get(index) === name) return;
  if (name) {
    if (!state.students.includes(name) || state.students.indexOf(name) !== state.students.lastIndexOf(name)) return;
    for (const [oldIndex, student] of state.publicLocks) {
      if (student === name) state.publicLocks.delete(oldIndex);
    }
    state.publicLocks.set(index, name);
    state.disabledSeats.delete(index);
  } else {
    state.publicLocks.delete(index);
  }
  state.assignment = [];
  buildGrid();
  saveClassesToStorage();
  showToast(name ? `${name} 학생의 좌석을 지정했습니다.` : '좌석 지정을 해제했습니다.');
}

// 좌석 클릭 처리
function handleSeatClick(seatIndex) {
  if (state.isShuffling) return;
  
  // 비밀 잠금 해제 상태 (관리자 모드 활성화 시)
  if (state.isSecretUnlocked) {
    const seatCard = document.querySelector(`.seat-card[data-index="${seatIndex}"]`);
    if (!seatCard || seatCard.querySelector('.seat-lock-select')) return;
    
    // 인라인 셀렉트 드롭다운 생성
    const select = document.createElement('select');
    select.className = 'seat-lock-select';
    select.setAttribute('aria-label', '이 좌석의 학생 또는 통로 설정');
    
    // 기본 플레이스홀더 옵션
    const optPlaceholder = document.createElement('option');
    optPlaceholder.value = '';
    optPlaceholder.textContent = '-- 학생 지정 --';
    select.appendChild(optPlaceholder);
    
    // 현재 고정되어 있는 학생
    const currentLock = state.locks.get(seatIndex);
    
    // 🔓 고정 해제 옵션 (현재 고정 상태일 때만)
    if (currentLock) {
      const optUnlock = document.createElement('option');
      optUnlock.value = '__unlock__';
      optUnlock.textContent = '🔓 고정 해제';
      select.appendChild(optUnlock);
    }
    
    // 🚧 통로로 변경 / 🟢 좌석으로 활성화 옵션
    const optToggleType = document.createElement('option');
    if (state.disabledSeats.has(seatIndex)) {
      optToggleType.value = '__enable__';
      optToggleType.textContent = '🟢 좌석으로 활성화';
    } else {
      optToggleType.value = '__disable__';
      optToggleType.textContent = '🚧 통로로 변경';
    }
    optToggleType.disabled = state.publicLocks.has(seatIndex);
    select.appendChild(optToggleType);
    
    // 학생 명단 옵션
    state.students.forEach(student => {
      const opt = document.createElement('option');
      opt.value = student;
      opt.textContent = student;
      if (currentLock === student) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });
    
    // 선택 변경 시 처리
    select.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === '__unlock__') {
        state.locks.delete(seatIndex);
        showToast("이 좌석의 고정이 해제되었습니다.", "success");
      } else if (val === '__enable__') {
        state.disabledSeats.delete(seatIndex);
        showToast("좌석이 활성화되었습니다.", "success");
      } else if (val === '__disable__') {
        state.disabledSeats.add(seatIndex);
        state.locks.delete(seatIndex);
        showToast("통로로 변경되었습니다.", "success");
      } else if (val) {
        // 동일한 학생이 다른 자리에 고정되어 있다면 해제 (중복 방지)
        for (const [idx, name] of state.locks.entries()) {
          if (name === val) {
            state.locks.delete(idx);
          }
        }
        state.locks.set(seatIndex, val);
        showToast(`[${val}] 학생이 이 자리에 고정되었습니다.`, "success");
      }
      
      buildGrid();
      saveClassesToStorage();
    });
    
    // 포커스 아웃 시 (사용자가 아무것도 선택 안 하고 다른 곳을 누르면 복원)
    select.addEventListener('blur', () => {
      setTimeout(() => {
        if (!state.isShuffling) buildGrid();
      }, 150);
    });
    
    // 이벤트 전파 방지 (셀렉트 클릭이 카드의 클릭 이벤트를 재호출하지 않도록)
    select.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    // 기존 카드 내용을 비우고 드롭다운 추가
    seatCard.innerHTML = '';
    const row = Math.floor(seatIndex / state.cols) + 1;
    const col = (seatIndex % state.cols) + 1;
    
    const infoSpan = document.createElement('span');
    infoSpan.className = 'seat-index';
    infoSpan.textContent = `${row}-${col} 설정`;
    
    seatCard.appendChild(infoSpan);
    seatCard.appendChild(select);
    
    // 드롭다운 포커싱
    select.focus();
    return;
  }
  
  // 이미 지정한 책상은 한 번 눌러 학생을 바꾸거나 지정을 해제할 수 있다.
  if (state.publicLocks.has(seatIndex)) {
    openInlineSeatPicker(seatIndex);
    return;
  }
  if (state.disabledSeats.has(seatIndex)) {
    state.disabledSeats.delete(seatIndex);
  } else {
    state.disabledSeats.add(seatIndex);
  }
  state.assignment = [];
  buildGrid();
  saveClassesToStorage();
}

// 그리드 차원 조절 핸들러
function updateGridDimensions(rows, cols) {
  const oldCols = state.cols;
  state.rows = rows;
  state.cols = cols;
  const remapped = new Map();
  for (const [index, student] of state.publicLocks) {
    const row = Math.floor(index / oldCols);
    const col = index % oldCols;
    const next = row * cols + col;
    if (row < rows && col < cols && !state.disabledSeats.has(next)) remapped.set(next, student);
  }
  state.publicLocks = remapped;
  
  DOM.gridRows.value = rows;
  DOM.gridCols.value = cols;
  DOM.rowsVal.textContent = rows;
  DOM.colsVal.textContent = cols;
  
  const totalSeats = rows * cols;
  
  // 데이터 보정
  const validDisabled = new Set();
  state.disabledSeats.forEach(idx => {
    if (idx < totalSeats) validDisabled.add(idx);
  });
  state.disabledSeats = validDisabled;
  
  const validLocks = new Map();
  state.locks.forEach((name, idx) => {
    if (idx < totalSeats) validLocks.set(idx, name);
  });
  state.locks = validLocks;
  
  state.assignment = [];
  buildGrid();
  saveClassesToStorage();
}

// 8. 프리셋 바인딩
const roomPresets = [
  { button: DOM.preset6x5, rows: 5, cols: 6, aisles: [] },
  { button: DOM.preset5x6, rows: 6, cols: 5, aisles: [] },
  {
    button: DOM.presetPairs, rows: 5, cols: 8,
    aisles: Array.from({ length: 5 }, (_, row) => [row * 8 + 2, row * 8 + 5]).flat(),
    message: '3분단 짝꿍 배치를 적용했습니다.'
  },
  {
    button: DOM.presetUShape, rows: 5, cols: 6,
    aisles: [7, 8, 9, 10, 13, 14, 15, 16, 19, 20, 21, 22],
    message: '디귿(U)자 배치를 적용했습니다.'
  }
];

for (const preset of roomPresets) {
  preset.button.addEventListener('click', () => {
    state.disabledSeats = new Set(preset.aisles);
    updateGridDimensions(preset.rows, preset.cols);
    if (preset.message) showToast(preset.message);
  });
}

function updateRoomControls() {
  for (const preset of roomPresets) {
    const matches = state.rows === preset.rows && state.cols === preset.cols &&
      state.disabledSeats.size === preset.aisles.length && preset.aisles.every(index => state.disabledSeats.has(index));
    preset.button.setAttribute('aria-pressed', String(matches));
  }
  for (const button of DOM.gridSteps) {
    const input = document.getElementById(button.getAttribute('aria-controls'));
    const next = input.valueAsNumber + Number(button.dataset.gridStep);
    button.disabled = state.isShuffling || next < Number(input.min) || next > Number(input.max);
  }
}

DOM.btnResetLayout.addEventListener('click', () => {
  state.disabledSeats.clear();
  state.publicLocks.clear();
  state.locks.clear();
  state.assignment = [];
  buildGrid();
  saveClassesToStorage();
  showToast("레이아웃이 초기화되었습니다.");
});

// 교탁 시점 보기 토글 (같은 배치를 교탁에서 학생들을 바라본 모습으로 180도 회전)
if (DOM.btnFlipView) {
  DOM.btnFlipView.addEventListener('click', () => {
    if (state.isShuffling) return;
    state.isFlippedView = !state.isFlippedView;
    buildGrid();
    showToast(
      state.isFlippedView
        ? "교탁 시점 보기: 교탁에서 학생들을 바라본 배치입니다."
        : "기본 보기: 교실 뒤에서 교탁을 바라본 배치입니다."
    );
  });
}

for (const input of [DOM.gridRows, DOM.gridCols]) {
  const isRows = input === DOM.gridRows;
  input.addEventListener('input', () => {
    const value = input.valueAsNumber;
    if (!input.validity.valid || !Number.isInteger(value) || state.isShuffling) return;
    if (value !== (isRows ? state.rows : state.cols)) {
      updateGridDimensions(isRows ? value : state.rows, isRows ? state.cols : value);
    }
  });
  input.addEventListener('change', () => { input.value = isRows ? state.rows : state.cols; });
}

for (const button of DOM.gridSteps) {
  button.addEventListener('click', () => {
    const input = document.getElementById(button.getAttribute('aria-controls'));
    input.stepUp(Number(button.dataset.gridStep));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

// ============================================================================
// 9. 대형 통합 탭 내비게이션 시스템
// ============================================================================
DOM.tabBtnSeating.addEventListener('click', () => switchMainTab('seating'));
DOM.tabBtnGroups.addEventListener('click', () => switchMainTab('groups'));
DOM.tabBtnPicker.addEventListener('click', () => switchMainTab('picker'));

function switchMainTab(tabName) {
  if (state.isShuffling) return; // 작업 중 차단
  
  closeInlineSeatPicker();
  cancelPendingSeatClick();
  state.activeTab = tabName;
  const activeTab = document.getElementById(`tab-btn-${tabName}`);
  const heading = document.getElementById('workspace-heading');
  heading.dataset.tool = tabName;
  heading.querySelector('h1').textContent = activeTab.textContent.trim();
  heading.querySelector('.workspace-symbol').replaceChildren(activeTab.querySelector('svg').cloneNode(true));
  for (const control of heading.querySelectorAll('[data-action-tool]')) {
    control.hidden = control.dataset.actionTool !== tabName;
  }
  for (const name of ['seating', 'groups', 'picker']) {
    const selected = name === tabName;
    const tab = document.getElementById(`tab-btn-${name}`);
    tab.setAttribute('aria-pressed', String(selected));
    tab.classList.toggle('active', selected);
    document.getElementById(`view-${name}`).classList.toggle('active', selected);
  }
  DOM.frontRowSettings.hidden = tabName !== 'seating';
  DOM.sidebarLayoutSettings.hidden = tabName !== 'seating';
  if (tabName === 'groups') renderGroupsList();
  if (tabName === 'picker') renderPickerList();
}


// ============================================================================
// 10. 조 짜기 (모둠 편성) 비즈니스 로직
// ============================================================================

// 추첨이 끝날 때까지 학급, 명단, 인원수와 배치 조건을 같은 상태로 유지한다.
function lockShuffleControls() {
  closeInlineSeatPicker();
  state.isShuffling = true;
  const controls = document.querySelectorAll(
    '.sidebar-panel :is(button, input, select, textarea):enabled, .main-tab-btn:enabled, ' +
    '#group-size:enabled, #picker-count:enabled, #btn-reset-layout:enabled, #btn-flip-view:enabled'
  );
  controls.forEach(control => { control.disabled = true; });
  return () => {
    controls.forEach(control => { control.disabled = false; });
    state.isShuffling = false;
  };
}

// 슬라이더 바인딩
DOM.groupSize.addEventListener('input', (e) => {
  state.targetGroupSize = parseInt(e.target.value);
  DOM.groupSizeVal.textContent = state.targetGroupSize;
  saveClassesToStorage();
});

// 균등 조 짜기 메인 함수
function runGroupShuffle() {
  if (state.isShuffling) return;
  
  const N = state.students.length;
  if (N === 0) {
    showToast("학생 명단을 먼저 기입하십시오.", "danger");
    return;
  }
  
  initAudio();
  const releaseControls = lockShuffleControls();
  DOM.btnGroupShuffle.disabled = true;
  DOM.btnGroupSaveImage.disabled = true;
  DOM.btnGroupCopyText.disabled = true;
  
  const S = state.targetGroupSize;
  // 균등 분배 알고리즘: 총 조 개수 G 계산
  let G = Math.round(N / S);
  if (G < 1) G = 1;
  
  // 기본 할당량 B 및 나머지 R
  const B = Math.floor(N / G);
  const R = N % G;
  
  // 조 크기 맵 생성: 앞의 R개 조는 B+1명, 뒤의 G-R개 조는 B명
  const groupSizes = [];
  for (let i = 0; i < G; i++) {
    groupSizes.push(i < R ? B + 1 : B);
  }
  
  let tickCount = 0;
  
  // 조 짜기 셔플 연출
  state.shuffleInterval = setInterval(() => {
    playTickSound();
    
    // 더미 랜덤 조 생성
    const tempStudents = [...state.students];
    shuffleArray(tempStudents);
    
    DOM.groupsBoard.innerHTML = '';
    
    for (let i = 0; i < G; i++) {
      const size = groupSizes[i];
      const members = tempStudents.splice(0, size);
      
      const card = document.createElement('div');
      card.className = 'group-table-card group-shuffling';
      card.innerHTML = `
        <div class="group-table-header">
          <span class="group-title">${i + 1}조</span>
          <span class="group-members-count">${size}명</span>
        </div>
        <ul class="group-members-list">
          ${members.map(m => `<li class="group-member-item">${nameAsHtmlText(m)}</li>`).join('')}
        </ul>
      `;
      DOM.groupsBoard.appendChild(card);
    }
    
    tickCount++;
    if (tickCount >= 18) {
      clearInterval(state.shuffleInterval);
      releaseControls();
      completeGroupShuffle(groupSizes);
    }
  }, 100);
}

// 셔플 연출 정지 후 스마트 거리두기 제약 검증 엔진 구동
function completeGroupShuffle(groupSizes) {
  const result = solveGroupAssignment(groupSizes);
  
  state.lastGroupAssignment = result.groups;
  renderGroupsList();
  playSuccessSound();
  
  if (result.success) {
    showToast("성공적으로 조 편성을 완료했습니다!");
  } else {
    showToast("조 편성을 완료했습니다.", "success");
  }
  
  DOM.btnGroupShuffle.disabled = false;
  DOM.btnGroupSaveImage.disabled = false;
  DOM.btnGroupCopyText.disabled = false;
  
  saveClassesToStorage();
}

// 스마트 제약 해결기
function solveGroupAssignment(groupSizes) {
  const N = state.students.length;
  const G = groupSizes.length;
  
  let bestGroups = null;
  let minViolations = Infinity;
  const maxRetries = 400;
  
  const applySep = true; // 비밀 거리두기(기피) 항상 강제 적용
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const tempPool = [...state.students];
    shuffleArray(tempPool);
    
    // 조별 분할
    const tempGroups = [];
    let studentIndex = 0;
    
    for (let i = 0; i < G; i++) {
      const size = groupSizes[i];
      const members = tempPool.slice(studentIndex, studentIndex + size);
      tempGroups.push(members);
      studentIndex += size;
    }
    
    // 제약 검증
    let violations = 0;
    
    if (applySep) {
      state.separatedPairs.forEach(([s1, s2]) => {
        if (!state.students.includes(s1) || !state.students.includes(s2)) return;
        
        // 두 명의 기피 학생이 동일한 조에 들어갔는지 검사
        const bothInSameGroup = tempGroups.some(group => group.includes(s1) && group.includes(s2));
        if (bothInSameGroup) {
          violations++;
        }
      });
    }
    
    if (violations === 0 || !applySep) {
      return {
        success: true,
        groups: tempGroups
      };
    }
    
    if (violations < minViolations) {
      minViolations = violations;
      bestGroups = tempGroups;
    }
  }
  
  return {
    success: false,
    groups: bestGroups
  };
}

// 최종 조 카드 렌더러
function renderGroupsList() {
  DOM.groupsBoard.innerHTML = '';
  
  if (state.lastGroupAssignment.length === 0) {
    DOM.groupsBoard.innerHTML = `
      <div class="group-empty-placeholder">
        <p>한 조의 인원수를 정하고 ‘조 짜기’를 눌러 주세요.</p>
      </div>
    `;
    DOM.btnGroupSaveImage.disabled = true;
    DOM.btnGroupCopyText.disabled = true;
    return;
  }
  
  state.lastGroupAssignment.forEach((group, index) => {
    const card = document.createElement('div');
    card.className = 'group-table-card';
    
    // 딜레이 페이드인 마이크로 연출
    card.style.animationDelay = `${index * 0.05}s`;
    
    card.innerHTML = `
      <div class="group-table-header">
        <span class="group-title">${index + 1}조</span>
        <span class="group-members-count">${group.length}명</span>
      </div>
      <ul class="group-members-list">
        ${group.map(m => `
          <li class="group-member-item">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="member-icon"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>${nameAsHtmlText(m)}</span>
          </li>
        `).join('')}
      </ul>
    `;
    DOM.groupsBoard.appendChild(card);
  });
  
  DOM.btnGroupSaveImage.disabled = false;
  DOM.btnGroupCopyText.disabled = false;
}


// ============================================================================
// 10-2. 랜덤 뽑기 (Random Picker) 비즈니스 로직
// ============================================================================

// 슬라이더 바인딩
if (DOM.pickerCount) {
  DOM.pickerCount.addEventListener('input', (e) => {
    state.targetPickerCount = parseInt(e.target.value);
    DOM.pickerCountVal.textContent = state.targetPickerCount;
    saveClassesToStorage();
  });
}

function runPickerShuffle() {
  if (state.isShuffling) return;
  
  const N = state.students.length;
  if (N === 0) {
    showToast("학생 명단을 먼저 기입하십시오.", "danger");
    return;
  }
  
  const P = state.targetPickerCount;
  if (P > N) {
    showToast("추첨 인원이 학생 수보다 많습니다.", "danger");
    return;
  }
  
  initAudio();
  const releaseControls = lockShuffleControls();
  DOM.btnPickerStart.disabled = true;
  DOM.btnPickerCopyText.disabled = true;
  
  // 추첨판 비우기 및 롤링 셔플용 임시 골든 티켓 스켈레톤 생성
  DOM.pickerBoard.innerHTML = '';
  const ticketEls = [];
  for (let i = 0; i < P; i++) {
    const ticket = document.createElement('div');
    ticket.className = 'picker-golden-ticket rolling';
    ticket.innerHTML = `
      <div class="picker-golden-ticket-inner">
        <span class="seat-index">티켓 #${i + 1}</span>
        <span class="student-name">추첨 중...</span>
      </div>
    `;
    DOM.pickerBoard.appendChild(ticket);
    ticketEls.push(ticket);
  }
  
  let tickCount = 0;
  
  // 1.5초 동안 85ms 간격으로 롤링 셔플
  state.shuffleInterval = setInterval(() => {
    playTickSound();
    
    // 임시로 무작위 학생 이름 노출 (슬롯 롤링 느낌)
    ticketEls.forEach((ticket) => {
      const randIndex = Math.floor(Math.random() * N);
      ticket.querySelector('.student-name').textContent = state.students[randIndex];
    });
    
    tickCount++;
    if (tickCount >= 18) { // 약 1.5초 (85ms * 18 = 1.53s)
      clearInterval(state.shuffleInterval);
      releaseControls();
      completePickerShuffle();
    }
  }, 85);
}

function completePickerShuffle() {
  // 실제 추첨 (중복 없이 Fisher-Yates 기반)
  const pool = [...state.students];
  shuffleArray(pool);
  
  const winners = pool.slice(0, state.targetPickerCount);
  state.lastPickerAssignment = winners;
  
  renderPickerList(0.2);

  playSuccessSound();
  showToast(`🎉 랜덤으로 ${state.targetPickerCount}명의 학생이 성공적으로 뽑혔습니다!`);
  
  DOM.btnPickerStart.disabled = false;
  DOM.btnPickerCopyText.disabled = false;
  
  saveClassesToStorage();
}

function renderPickerList(delayStep = 0.05) {
  DOM.pickerBoard.innerHTML = '';
  
  if (!state.lastPickerAssignment || state.lastPickerAssignment.length === 0) {
    DOM.pickerBoard.innerHTML = `
      <div class="group-empty-placeholder" style="width: 100%;">
        <p>뽑을 인원수를 정하고 ‘추첨 시작’을 눌러 주세요.</p>
      </div>
    `;
    if (DOM.btnPickerCopyText) DOM.btnPickerCopyText.disabled = true;
    return;
  }
  
  state.lastPickerAssignment.forEach((winner, index) => {
    const ticket = document.createElement('div');
    ticket.className = 'picker-golden-ticket';
    ticket.style.animationDelay = `${index * delayStep}s`;
    ticket.innerHTML = `
      <div class="picker-golden-ticket-inner">
        <span class="seat-index">당첨 티켓 #${index + 1}</span>
        <span class="student-name"></span>
      </div>
    `;
    ticket.querySelector('.student-name').textContent = winner;
    DOM.pickerBoard.appendChild(ticket);
  });
  
  if (DOM.btnPickerCopyText) DOM.btnPickerCopyText.disabled = false;
}

function copyPickerText() {
  if (state.isShuffling || !state.lastPickerAssignment || state.lastPickerAssignment.length === 0) return;
  
  let out = `🎲 [${state.activeClass || '바로 사용'} 랜덤 추첨 결과]\n`;
  out += `=======================\n`;
  state.lastPickerAssignment.forEach((winner, index) => {
    out += `당첨 #${index + 1}: ${winner}\n`;
  });
  out += `=======================\n`;
  
  navigator.clipboard.writeText(out).then(() => {
    showToast("추첨 결과 텍스트가 클립보드에 복사되었습니다!");
  });
}


// ============================================================================
// 11. 자리배치 랜덤 Shuffler 구동부
// ============================================================================

function runShuffle() {
  if (state.isShuffling) return;
  flushPendingSeatClick();
  
  const activeSeats = getActiveSeatIndices();
  if (state.students.length === 0) {
    showToast("학생 명단을 먼저 입력하세요.", "danger");
    return;
  }
  
  if (state.students.length > activeSeats.length) {
    showToast("활성화된 자리가 학생 수보다 부족합니다.", "danger");
    return;
  }
  
  const result = solveSeatingAssignment(activeSeats);
  if (!result.success) {
    showToast(result.error, 'warning');
    return;
  }

  initAudio();
  const releaseControls = lockShuffleControls();
  if (DOM.seatsGrid.querySelector('.seat-lock-select')) buildGrid();
  DOM.btnShuffle.disabled = true;
  DOM.btnSaveStudent.disabled = true;
  DOM.btnSaveTeacher.disabled = true;
  closeSaveMenus();

  let tickCount = 0;
  state.shuffleInterval = setInterval(() => {
    playTickSound();
    
    const tempShuffled = [...state.students];
    while (tempShuffled.length < activeSeats.length) {
      tempShuffled.push('빈자리');
    }
    shuffleArray(tempShuffled);
    
    const seatCards = document.querySelectorAll('.seat-card');
    seatCards.forEach(card => {
      const idx = parseInt(card.dataset.index);
      if (state.disabledSeats.has(idx)) return;
      
      card.classList.add('shuffle-roll');
      
      const publicName = state.publicLocks.get(idx);
      const visibleSecret = state.isSecretUnlocked && state.locks.get(idx) === result.assignment[idx];
      if (publicName || visibleSecret) {
        card.querySelector('.student-name').textContent = result.assignment[idx];
        card.classList.remove('shuffle-roll');
      } else {
        const randName = tempShuffled.pop();
        card.querySelector('.student-name').textContent = randName === '빈자리' ? 'X' : randName;
      }
    });
    
    tickCount++;
    if (tickCount >= 18) {
      clearInterval(state.shuffleInterval);
      releaseControls();
      completeShuffle(result.assignment);
    }
  }, 100);
}

function completeShuffle(assignment) {
  state.assignment = assignment;
  buildGrid();
  
  const seatCards = document.querySelectorAll('.seat-card');
  seatCards.forEach(card => {
    card.classList.remove('shuffle-roll');
    const idx = parseInt(card.dataset.index);
    if (state.disabledSeats.has(idx)) return;
    
    card.classList.add('assigned');
    const assignedName = state.assignment[idx];
    if (assignedName === '빈자리' || assignedName === 'X') {
      card.classList.add('empty-seat');
    }
    
    const nameEl = card.querySelector('.student-name');
    nameEl.style.transform = 'scale(0.3)';
    nameEl.style.opacity = '0';
    setTimeout(() => {
      nameEl.style.transform = 'scale(1)';
      nameEl.style.opacity = '1';
    }, 50);
  });
  
  playSuccessSound();
  
  showToast("자리 배치를 완료했습니다.");
  saveClassesToStorage();
}

// 셔플 유틸리티
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// 자리 배정 CS 엔진
function solveSeatingAssignment(activeSeats) {
  const plan = getSeatingPlan(activeSeats);
  if (plan.error) return { success: false, error: plan.error };
  if (state.students.length > activeSeats.length) {
    return { success: false, error: '학생 수에 맞게 좌석을 추가하세요.' };
  }

  for (let attempt = 0; attempt < 400; attempt++) {
    const assignment = new Array(state.rows * state.cols).fill(null);
    plan.lockedSeats.forEach((name, index) => { assignment[index] = name; });

    const frontSeats = [...plan.freeFrontSeats];
    shuffleArray(frontSeats);
    plan.frontStudents.forEach((name, i) => { assignment[frontSeats[i]] = name; });

    const remainingSeats = plan.freeSeats.filter(index => assignment[index] === null);
    shuffleArray(remainingSeats);
    remainingSeats.forEach((index, i) => {
      assignment[index] = plan.remainingStudents[i] ?? '빈자리';
    });

    if (countSeparationViolations(assignment) === 0) {
      return { success: true, assignment };
    }
  }

  const error = state.isSecretUnlocked
    ? '거리두기와 좌석 설정을 함께 만족하는 배치를 찾지 못했습니다. 설정을 확인한 뒤 다시 시도하세요.'
    : '현재 설정에 맞는 배치를 찾지 못했습니다. 좌석 구성을 조정하거나 다시 시도하세요.';
  return { success: false, error };
}

function countSeparationViolations(assignment) {
  let violations = 0;
  state.separatedPairs.forEach(([s1, s2]) => {
    if (!state.students.includes(s1) || !state.students.includes(s2)) return;
    const idxA = assignment.indexOf(s1);
    const idxB = assignment.indexOf(s2);
    
    if (idxA !== -1 && idxB !== -1) {
      const rA = Math.floor(idxA / state.cols);
      const cA = idxA % state.cols;
      const rB = Math.floor(idxB / state.cols);
      const cB = idxB % state.cols;
      
      const rD = Math.abs(rA - rB);
      const cD = Math.abs(cA - cB);
      
      if (rD <= 1 && cD <= 1) {
        violations++;
      }
    }
  });
  return violations;
}


// ============================================================================
// 12. 학급 그룹 관리 세부 핸들러 (Save / Delete / Load)
// ============================================================================

function switchRoster(name) {
  loadClassData(name);
  localStorage.setItem(ACTIVE_CLASS_KEY, name);
}

DOM.classSelect.addEventListener('change', () => {
  switchRoster(DOM.classSelect.value);
});

DOM.btnQuickRoster.addEventListener('click', () => {
  switchRoster('');
  DOM.studentList.focus();
});

DOM.btnCreateClass.addEventListener('click', () => {
  DOM.classForm.reset();
  clearClassFormError();
  DOM.classDialog.showModal();
});

DOM.btnCancelClass.addEventListener('click', () => DOM.classDialog.close());

function clearClassFormError() {
  DOM.classFormError.hidden = true;
  DOM.newClassName.removeAttribute('aria-invalid');
  DOM.newClassStudents.removeAttribute('aria-invalid');
}

function showClassFormError(field, message) {
  DOM.classFormError.textContent = message;
  DOM.classFormError.hidden = false;
  field.setAttribute('aria-invalid', 'true');
  field.focus();
}

DOM.classForm.addEventListener('input', clearClassFormError);
DOM.classForm.addEventListener('submit', event => {
  event.preventDefault();
  const name = DOM.newClassName.value.trim();
  const studentsText = DOM.newClassStudents.value.trim();
  if (!name) return showClassFormError(DOM.newClassName, '학급 이름을 입력해 주세요.');
  if (!splitStudentNames(studentsText).length) return showClassFormError(DOM.newClassStudents, '학생 이름을 한 명 이상 입력해 주세요.');

  try {
    const classes = readStoredRecord(CLASSES_KEY);
    if (Object.hasOwn(classes, name)) return showClassFormError(DOM.newClassName, '같은 이름의 학급이 있습니다. 다른 이름을 입력해 주세요.');
    classes[name] = { studentsText };
    localStorage.setItem(CLASSES_KEY, JSON.stringify(classes));
    state.classes = classes;
  } catch (error) {
    console.error(error);
    DOM.classFormError.textContent = '학급을 저장할 수 없습니다. 브라우저 저장 공간을 확인해 주세요.';
    DOM.classFormError.hidden = false;
    return;
  }
  populateClassSelectDropdown();
  switchRoster(name);
  DOM.classDialog.close();
  showToast(`${name} 학급을 저장했습니다.`);
});

DOM.btnDeleteClass.addEventListener('click', () => {
  const name = state.activeClass;
  if (!name || !confirm(`[${name}] 학급과 저장된 결과를 삭제할까요?`)) return;
  const classes = readStoredRecord(CLASSES_KEY);
  delete classes[name];
  localStorage.setItem(CLASSES_KEY, JSON.stringify(classes));
  state.classes = classes;
  populateClassSelectDropdown();
  switchRoster('');
  showToast(`${name} 학급을 삭제했습니다.`);
});

// ============================================================================
// 13. 라이트 / 다크 테마 전환 스크립트
// ============================================================================

DOM.btnThemeToggle.addEventListener('click', () => {
  if (document.body.classList.contains('light-theme')) {
    document.body.classList.remove('light-theme');
    state.theme = 'dark';
  } else {
    document.body.classList.add('light-theme');
    state.theme = 'light';
  }
  
  localStorage.setItem('seat_arranger_active_theme', state.theme);
  showToast(`${state.theme === 'light' ? '라이트 테마' : '다크 테마'}로 화면 테마가 전환되었습니다.`);
});

function initTheme() {
  const savedTheme = localStorage.getItem('seat_arranger_active_theme');
  if (savedTheme !== 'dark') {
    document.body.classList.add('light-theme');
    state.theme = 'light';
  } else {
    document.body.classList.remove('light-theme');
    state.theme = 'dark';
  }
}


// ============================================================================
// 14. 비밀 제약 조건 콘솔 및 사이드바 바인딩 (Shortcut & Separation Rules)
// ============================================================================

function toggleSecretMode() {
  if (state.isShuffling) return;
  state.isSecretUnlocked = !state.isSecretUnlocked;
  
  if (state.isSecretUnlocked) {
    DOM.secretSidebarPanel.classList.add('show');
    // 노출 힌트와 토스트 알림을 완전히 비활성화하여 학생들의 의심을 원천 차단
  } else {
    DOM.secretSidebarPanel.classList.remove('show');
  }
  
  buildGrid();
}

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'S') {
    e.preventDefault();
    toggleSecretMode();
  }
});

let titleClicks = 0;
if (DOM.appTitleTrigger) {
  DOM.appTitleTrigger.addEventListener('click', () => {
    titleClicks++;
    if (titleClicks >= 5) {
      titleClicks = 0;
      toggleSecretMode();
    }
  });
}

function updateModalStudentSelects() {
  for (const select of [DOM.sepStudent1, DOM.sepStudent2]) {
    select.replaceChildren(new Option('-- 학생 선택 --', ''));
    for (const name of state.students) select.add(new Option(name, name));
  }
}

DOM.btnAddSep.addEventListener('click', () => {
  const s1 = DOM.sepStudent1.value;
  const s2 = DOM.sepStudent2.value;
  
  if (!s1 || !s2) {
    showToast("두 명의 학생을 지정하세요.", "warning");
    return;
  }
  if (s1 === s2) {
    showToast("자기 자신과 기피할 수 없습니다.", "warning");
    return;
  }
  
  const isDuplicate = state.separatedPairs.some(([a, b]) => (a === s1 && b === s2) || (a === s2 && b === s1));
  if (isDuplicate) {
    showToast("이미 등록된 분리 규칙입니다.", "warning");
    return;
  }
  
  state.separatedPairs.push([s1, s2]);
  DOM.sepStudent1.value = '';
  DOM.sepStudent2.value = '';
  
  updateSeparationsList();
  saveClassesToStorage();
  showToast(`[${s1}] & [${s2}] 거리두기 규칙 추가 성공.`);
});

function updateSeparationsList() {
  if (!DOM.sepsListUl) return;
  DOM.sepsListUl.innerHTML = '';
  let count = 0;
  state.separatedPairs.forEach(([s1, s2], idx) => {
    if (state.students.includes(s1) && state.students.includes(s2)) {
      count++;
      const li = document.createElement('li');
      li.innerHTML = `
        <span><strong>${nameAsHtmlText(s1)}</strong> &lt;&gt; <strong>${nameAsHtmlText(s2)}</strong> (분리)</span>
        <button type="button" class="btn-delete-rule" data-idx="${idx}">제거</button>
      `;
      DOM.sepsListUl.appendChild(li);
    }
  });
  if (DOM.sepsCount) DOM.sepsCount.textContent = count;
  if (count === 0) DOM.sepsListUl.innerHTML = '<li class="empty-placeholder">등록된 기피 쌍이 없습니다.</li>';
  
  DOM.sepsListUl.querySelectorAll('.btn-delete-rule').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      state.separatedPairs.splice(idx, 1);
      updateSeparationsList();
      saveClassesToStorage();
      showToast("격리 규칙이 제거되었습니다.");
    });
  });
}


// ============================================================================
// 15. 이미지 내보내기 & 텍스트 공유
// ============================================================================

// 공용 캡처 헬퍼: 대상 요소를 html2canvas 캔버스로 캡처
function captureElementToCanvas(element, bgColor) {
  return new Promise((resolve, reject) => {
    // 레이아웃 리플로우가 반영될 시간을 잠시 확보한 뒤 캡처
    setTimeout(() => {
      html2canvas(element, {
        backgroundColor: bgColor,
        scale: 2,
        logging: false,
        useCORS: true
      }).then(resolve).catch(reject);
    }, 200);
  });
}

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function getCaptureBgColor() {
  return getComputedStyle(document.body).backgroundColor;
}

// 저장 옵션 드롭업 메뉴 열기/닫기
function closeSaveMenus() {
  document.querySelectorAll('.save-menu-wrapper.open').forEach(w => w.classList.remove('open'));
}

function toggleSaveMenu(wrapperBtn) {
  const wrapper = wrapperBtn.closest('.save-menu-wrapper');
  const wasOpen = wrapper.classList.contains('open');
  closeSaveMenus();
  if (!wasOpen) wrapper.classList.add('open');
}

if (DOM.btnSaveStudent) {
  DOM.btnSaveStudent.addEventListener('click', (e) => {
    e.stopPropagation();
    if (DOM.btnSaveStudent.disabled) return;
    toggleSaveMenu(DOM.btnSaveStudent);
  });
}
if (DOM.btnSaveTeacher) {
  DOM.btnSaveTeacher.addEventListener('click', (e) => {
    e.stopPropagation();
    if (DOM.btnSaveTeacher.disabled) return;
    toggleSaveMenu(DOM.btnSaveTeacher);
  });
}

// 메뉴 밖 클릭 시 닫기
document.addEventListener('click', (e) => {
  if (!e.target.closest('.save-menu-wrapper')) closeSaveMenus();
});

// 메뉴 항목(PDF/PNG) 클릭 바인딩
document.querySelectorAll('.save-menu-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    const isTeacherView = item.dataset.teacher === 'true';
    const format = item.dataset.format; // 'pdf' | 'png'
    closeSaveMenus();
    saveSeatingChart(isTeacherView, format);
  });
});

// 1) 자리배치 내보내기 — 학생용(교탁 위) / 교사용(교탁 시점, 교탁 아래)을 PDF 또는 PNG로 저장
async function saveSeatingChart(isTeacherView, format) {
  if (state.isShuffling || state.assignment.length === 0) return;

  if (typeof html2canvas === 'undefined') {
    showToast("이미지 저장 라이브러리(html2canvas)를 가져오지 못했습니다. 인터넷망 연결 상태를 확인해주시거나, 오프라인 환경인 경우 html2canvas.min.js 파일을 다운로드하여 같은 폴더에 두고 불러와야 합니다.", "danger");
    return;
  }
  if (format === 'pdf' && (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF)) {
    showToast("PDF 저장 라이브러리(jsPDF)를 가져오지 못했습니다. 인터넷망 연결 상태를 확인해주세요.", "danger");
    return;
  }

  const viewLabel = isTeacherView ? '교사용' : '학생용';
  showToast(`${viewLabel} 배치표를 ${format.toUpperCase()}로 저장하고 있습니다...`, "success");

  const prevFlipped = state.isFlippedView;
  const dateStr = new Date().toISOString().slice(0, 10);
  const bg = getCaptureBgColor();
  const baseName = `자리배치결과_${state.activeClass || '바로 사용'}_${dateStr}_${viewLabel}`;

  document.body.classList.add('html2canvas-capturing');

  try {
    // 학생용: 뒤에서 교탁을 바라본 기본 배치 / 교사용: 교탁에서 바라본 180도 회전 배치
    state.isFlippedView = isTeacherView;
    buildGrid();
    const canvas = await captureElementToCanvas(DOM.classroomCanvas, bg);

    if (format === 'png') {
      downloadDataUrl(canvas.toDataURL('image/png'), `${baseName}.png`);
    } else {
      // A4 용지에 여백을 두고 비율 유지로 배치 (인쇄 최적화)
      const { jsPDF } = window.jspdf;
      const isLandscape = canvas.width >= canvas.height;
      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const ratio = Math.min((pageW - margin * 2) / canvas.width, (pageH - margin * 2) / canvas.height);
      const imgW = canvas.width * ratio;
      const imgH = canvas.height * ratio;
      // 배경이 단색이므로 JPEG 고품질 압축으로 파일 용량 최소화 (인쇄 품질 유지)
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', (pageW - imgW) / 2, (pageH - imgH) / 2, imgW, imgH);
      pdf.save(`${baseName}.pdf`);
    }

    showToast(`${viewLabel} 자리 배치표가 ${format.toUpperCase()} 파일로 다운로드되었습니다!`);
  } catch (err) {
    console.error(err);
    showToast("파일 저장 중 렌더링에 실패했습니다. (보안 제한 또는 캔버스 오류)", "danger");
  } finally {
    // 저장 전 보기 상태로 복원
    state.isFlippedView = prevFlipped;
    document.body.classList.remove('html2canvas-capturing');
    buildGrid();
  }
}

// 2) 조 짜기 결과 내보내기
DOM.btnGroupSaveImage.addEventListener('click', () => {
  if (state.isShuffling || state.lastGroupAssignment.length === 0) return;
  
  if (typeof html2canvas === 'undefined') {
    showToast("이미지 저장 라이브러리(html2canvas)를 가져오지 못했습니다. 인터넷망 연결 상태를 확인해주시거나, 오프라인 환경인 경우 html2canvas.min.js 파일을 다운로드하여 같은 폴더에 두고 불러와야 합니다.", "danger");
    return;
  }
  
  showToast("조 편성표 이미지를 캡처하고 있습니다...", "success");
  
  document.body.classList.add('html2canvas-capturing');
  
  setTimeout(() => {
    try {
      const bg = getCaptureBgColor();
      html2canvas(DOM.groupCanvas, {
        backgroundColor: bg,
        scale: 2,
        logging: false,
        useCORS: true
      }).then(canvas => {
        document.body.classList.remove('html2canvas-capturing');
        const link = document.createElement('a');
        link.download = `모둠편성결과_${state.activeClass || '바로 사용'}_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("소그룹 조 편성표가 다운로드되었습니다!");
      }).catch(err => {
        document.body.classList.remove('html2canvas-capturing');
        console.error(err);
        showToast("이미지 캡처 중 렌더링에 실패했습니다. (보안 제한 또는 캔버스 오류)", "danger");
      });
    } catch (e) {
      document.body.classList.remove('html2canvas-capturing');
      console.error(e);
      showToast("이미지 저장 도중 브라우저 보안 또는 스크립트 에러가 발생했습니다.", "danger");
    }
  }, 150);
});

DOM.btnGroupCopyText.addEventListener('click', () => {
  if (state.isShuffling || state.lastGroupAssignment.length === 0) return;
  
  let out = `👥 [${state.activeClass || '바로 사용'} 소그룹 조 편성표]\n`;
  out += `=======================\n`;
  state.lastGroupAssignment.forEach((group, index) => {
    out += `${index + 1}조 (${group.length}명): ${group.join(', ')}\n`;
  });
  out += `=======================\n`;
  
  navigator.clipboard.writeText(out).then(() => {
    showToast("조 편성 텍스트가 클립보드에 복사되었습니다!");
  });
});


// ============================================================================
// 16. 패키지 데이터 로드 및 초기화
// ============================================================================

function initClasses() {
  try {
    state.classes = readStoredRecord(CLASSES_KEY);
  } catch (error) {
    console.error(error);
    showToast('저장한 학급을 불러오지 못했습니다.', 'warning');
  }
  try {
    state.quickRoster = readStoredRecord(QUICK_ROSTER_KEY);
  } catch (error) {
    console.error(error);
    showToast('바로 사용 명단을 불러오지 못했습니다.', 'warning');
  }
  const lastClass = localStorage.getItem(ACTIVE_CLASS_KEY);
  state.activeClass = lastClass && Object.hasOwn(state.classes, lastClass) ? lastClass : '';
}

// 작은 화면에서도 데스크톱과 같은 입력 요소를 사용해 명단과 배치 조건을 유지한다.
function initSettingsDrawer() {
  const settings = document.getElementById('class-settings');
  const workspace = document.getElementById('workspace');
  const drawer = document.getElementById('settings-drawer');
  const opener = document.getElementById('btn-open-settings');
  const compact = window.matchMedia('(max-width: 1023px)');
  opener.addEventListener('click', () => {
    if (!compact.matches || drawer.open) return;
    drawer.append(settings);
    drawer.showModal();
  });
  document.getElementById('btn-close-settings').addEventListener('click', () => drawer.close());
  drawer.addEventListener('click', event => {
    if (event.target !== drawer) return;
    const bounds = drawer.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) drawer.close();
  });
  drawer.addEventListener('close', () => {
    if (!drawer.open) workspace.before(settings);
  });
  compact.addEventListener('change', () => {
    if (!compact.matches && drawer.open) drawer.close();
  });
}

function init() {
  initSettingsDrawer();
  initTheme();
  initClasses();
  
  populateClassSelectDropdown();
  loadClassData(state.activeClass);
  
  // 리스너 바인딩
  DOM.studentList.addEventListener('input', () => parseStudents(true));
  DOM.btnShuffle.addEventListener('click', runShuffle);
  DOM.btnGroupShuffle.addEventListener('click', runGroupShuffle);
  
  // Picker 리스너 바인딩
  if (DOM.btnPickerStart) {
    DOM.btnPickerStart.addEventListener('click', runPickerShuffle);
  }
  if (DOM.btnPickerCopyText) {
    DOM.btnPickerCopyText.addEventListener('click', copyPickerText);
  }
}

document.addEventListener('DOMContentLoaded', init);
