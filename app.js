/* ==========================================
   스마트 클래스 자리배치 & 모둠기 - app.js
   Full Integration of Seating, Group Maker, Themes, and Class Groups
   ========================================== */

// 1. 애플리케이션 상태 관리 객체 (State)
const state = {
  // 학급 목록 (Map형식의 Object: { '학급명': { studentsText, disabledSeats, locks, separatedPairs, lastAssignment, lastGroupAssignment, rows, cols } })
  classes: {},
  activeClass: '1학년 1반 예시', // 현재 활성화된 학급명
  
  // 현재 학급의 바인딩된 상태 변수들
  rows: 5,
  cols: 6,
  students: [],
  disabledSeats: new Set(),
  locks: new Map(), // seatIndex -> studentName
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
  theme: 'dark', // 'dark' | 'light'
  activeTab: 'seating', // 'seating' | 'groups' | 'picker'
  
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
  btnDeleteClass: document.getElementById('btn-delete-class'),
  newClassName: document.getElementById('new-class-name'),
  btnSaveClass: document.getElementById('btn-save-class'),
  
  // 학생 명단 및 레이아웃 설정
  studentList: document.getElementById('student-list'),
  studentCount: document.getElementById('student-count'),
  gridRows: document.getElementById('grid-rows'),
  gridCols: document.getElementById('grid-cols'),
  rowsVal: document.getElementById('rows-val'),
  colsVal: document.getElementById('cols-val'),
  preset6x5: document.getElementById('preset-6x5'),
  preset5x6: document.getElementById('preset-5x6'),
  presetPairs: document.getElementById('preset-pairs'),
  presetUShape: document.getElementById('preset-u-shape'),
  btnResetLayout: document.getElementById('btn-reset-layout'),
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
  classroomCanvas: document.getElementById('classroom-canvas'),
  btnShuffle: document.getElementById('btn-shuffle'),
  btnSaveImage: document.getElementById('btn-save-image'),
  btnCopyText: document.getElementById('btn-copy-text'),
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
  
  toast.innerHTML = `${icon}<span>${message}</span>`;
  DOM.toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

// 5. 학급(그룹) 관리 로직
const DEFAULT_CLASSES = {
  '1학년 1반 예시': {
    studentsText: '강민준\n권도윤\n김도현\n김민재\n김우진\n김준우\n김지호\n박민준\n박서준\n박예준\n서우진\n송민우\n신도윤\n안지후\n양도현\n오재원\n유태양\n윤도현\n이건우\n이도현\n이민우\n이서준\n임지훈\n정민준\n조현우',
    disabledSeats: [2, 5, 8, 11, 14, 17, 20, 23, 26, 29], // 짝꿍 배치 형태 통로
    locks: [[6, '강민준'], [12, '조현우']],
    separatedPairs: [['김민재', '김우진'], ['이서준', '정민준']],
    lastAssignment: [],
    lastGroupAssignment: [],
    rows: 5,
    cols: 6
  },
  '1학년 2반 예시': {
    studentsText: '김가은\n김나은\n김다은\n김민서\n김서아\n김서연\n김서현\n김수아\n김수빈\n김아윤\n김예은\n김지민\n김지아\n김지안\n김지우\n김지유\n김하은\n박서윤\n박소율\n박아린\n박채원\n서아윤\n서윤아\n신지우\n윤서연\n이서윤\n이서현\n이소율',
    disabledSeats: [7, 8, 9, 10, 13, 14, 15, 16, 19, 20, 21, 22], // U자형 형태 통로
    locks: [],
    separatedPairs: [['김가은', '김나은']],
    lastAssignment: [],
    lastGroupAssignment: [],
    rows: 5,
    cols: 6
  }
};

// 학급 로컬스토리지 보존
function saveClassesToStorage() {
  // 현재 활성화된 학급 데이터를 객체에 최신화하여 백업
  captureCurrentClassState();
  
  // 전체 직렬화
  const dataToSave = {};
  for (const name in state.classes) {
    const cl = state.classes[name];
    dataToSave[name] = {
      studentsText: cl.studentsText,
      disabledSeats: Array.from(cl.disabledSeats),
      locks: Array.from(cl.locks.entries()),
      separatedPairs: cl.separatedPairs,
      lastAssignment: cl.lastAssignment,
      lastGroupAssignment: cl.lastGroupAssignment,
      lastPickerAssignment: cl.lastPickerAssignment || [],
      rows: cl.rows,
      cols: cl.cols
    };
  }
  
  localStorage.setItem('seat_arranger_classes_package', JSON.stringify(dataToSave));
  localStorage.setItem('seat_arranger_active_class_name', state.activeClass);
}

// 현재 활성화 상태를 학급 데이터 캐시에 반영
function captureCurrentClassState() {
  if (!state.activeClass) return;
  
  state.classes[state.activeClass] = {
    studentsText: DOM.studentList.value,
    disabledSeats: new Set(state.disabledSeats),
    locks: new Map(state.locks),
    separatedPairs: [...state.separatedPairs],
    lastAssignment: [...state.assignment],
    lastGroupAssignment: [...state.lastGroupAssignment],
    lastPickerAssignment: [...state.lastPickerAssignment],
    rows: state.rows,
    cols: state.cols
  };
}

// 학급 불러오기 및 UI 주입
function loadClassData(className) {
  const cl = state.classes[className];
  if (!cl) return;
  
  state.activeClass = className;
  
  // 상태 변수 매핑
  state.rows = cl.rows || 5;
  state.cols = cl.cols || 6;
  state.disabledSeats = new Set(cl.disabledSeats || []);
  state.locks = new Map(cl.locks || []);
  state.separatedPairs = cl.separatedPairs || [];
  state.assignment = cl.lastAssignment || [];
  state.lastGroupAssignment = cl.lastGroupAssignment || [];
  state.lastPickerAssignment = cl.lastPickerAssignment || [];
  
  // UI 바인딩
  DOM.studentList.value = cl.studentsText || '';
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
  
  updateSeparationsList();
}

// 드롭다운 채우기
function populateClassSelectDropdown() {
  DOM.classSelect.innerHTML = '';
  
  for (const name in state.classes) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    DOM.classSelect.appendChild(opt);
  }
  
  DOM.classSelect.value = state.activeClass;
}

// 학생 리스트 파싱
function parseStudents(shouldSave = true) {
  const text = DOM.studentList.value;
  state.students = text
    .split(/[\n,]+/)
    .map(name => name.trim())
    .filter(name => name.length > 0);
  
  DOM.studentCount.textContent = state.students.length;
  
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
    saveClassesToStorage();
  }
}

// 6. 상태 배지 업데이트
function updateStatusIndicators() {
  const totalSeats = state.rows * state.cols;
  const activeCount = totalSeats - state.disabledSeats.size;
  
  DOM.seatStatusBadge.textContent = `좌석 설정: ${activeCount}석 활성`;
  
  const studentCount = state.students.length;
  if (studentCount === 0) {
    DOM.diffStatusBadge.textContent = "명단을 입력하세요";
    DOM.diffStatusBadge.className = "status-badge mismatch";
    DOM.btnShuffle.disabled = true;
    DOM.btnGroupShuffle.disabled = true;
    DOM.btnPickerStart.disabled = true;
  } else if (studentCount > activeCount) {
    DOM.diffStatusBadge.textContent = `자리 부족 (${studentCount - activeCount}석 부족)`;
    DOM.diffStatusBadge.className = "status-badge mismatch";
    DOM.btnShuffle.disabled = true;
    DOM.btnGroupShuffle.disabled = false; // 조짜기는 자리 제약 무관
    DOM.btnPickerStart.disabled = false;
  } else {
    const emptyCount = activeCount - studentCount;
    DOM.diffStatusBadge.textContent = `안정적 (빈자리 ${emptyCount}석)`;
    DOM.diffStatusBadge.className = "status-badge match";
    DOM.btnShuffle.disabled = false;
    DOM.btnGroupShuffle.disabled = false;
    DOM.btnPickerStart.disabled = false;
  }
}

// 7. 좌석 그리드 빌더
function buildGrid() {
  const container = DOM.seatsGrid;
  container.innerHTML = '';
  container.style.gridTemplateColumns = `repeat(${state.cols}, 1fr)`;
  
  const totalSeats = state.rows * state.cols;
  
  for (let i = 0; i < totalSeats; i++) {
    const row = Math.floor(i / state.cols) + 1;
    const col = (i % state.cols) + 1;
    
    const seat = document.createElement('div');
    seat.className = 'seat-card';
    seat.dataset.index = i;
    
    if (state.disabledSeats.has(i)) {
      seat.classList.add('disabled');
      seat.innerHTML = `<span class="student-name">통 로</span>`;
    } else {
      seat.classList.add('active');
      
      const lockedName = state.locks.get(i);
      const isLockedValid = lockedName && state.students.includes(lockedName);
      
      // 관리자 모드가 켜져 있을 때만 고정된 이름을 노출하고 핀 표시
      if (state.isSecretUnlocked && isLockedValid) {
        seat.classList.add('assigned');
        seat.innerHTML = `
          <span class="seat-index">${row}열-${col}행</span>
          <span class="student-name">${lockedName}</span>
          ${getPinSVG()}
        `;
      } else {
        if (lockedName && !state.students.includes(lockedName)) {
          state.locks.delete(i);
        }
        
        // 관리자 모드가 꺼진 평상시에는 배치표(assignment) 결과 유무에 따름
        if (state.assignment[i] && state.students.includes(state.assignment[i])) {
          seat.classList.add('assigned');
          const isAssignedEmpty = state.assignment[i] === '빈자리' || state.assignment[i] === 'X';
          
          if (isAssignedEmpty) seat.classList.add('empty-seat');
          
          seat.innerHTML = `
            <span class="seat-index">${row}열-${col}행</span>
            <span class="student-name">${state.assignment[i]}</span>
          `;
        } else {
          seat.innerHTML = `
            <span class="seat-index">${row}열-${col}행</span>
            <span class="student-name">좌 석</span>
          `;
        }
      }
    }
    
    seat.addEventListener('click', () => handleSeatClick(i));
    container.appendChild(seat);
  }
  
  // 저장 및 복사 버튼 상태 동기화 (유효한 배치가 있는 경우에만 활성화)
  const hasAssignment = state.assignment && state.assignment.length > 0 && state.assignment.some(name => name && name !== '좌 석' && name !== 'X');
  DOM.btnSaveImage.disabled = !hasAssignment;
  DOM.btnCopyText.disabled = !hasAssignment;
  
  updateStatusIndicators();
}

function getPinSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pin-indicator"><line x1="12" x2="12" y1="17" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.5A2 2 0 0 1 15 9.26V5a3 3 0 0 0-6 0v4.26a2 2 0 0 1-.78 1.24l-2.78 3.5a2 2 0 0 0-.44 1.24Z"/></svg>`;
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
        buildGrid();
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
    infoSpan.textContent = `${row}열-${col}행 설정`;
    
    seatCard.appendChild(infoSpan);
    seatCard.appendChild(select);
    
    // 드롭다운 포커싱
    select.focus();
    return;
  }
  
  // 일반 상태: 통로 토글
  if (state.disabledSeats.has(seatIndex)) {
    state.disabledSeats.delete(seatIndex);
  } else {
    state.disabledSeats.add(seatIndex);
    if (state.locks.has(seatIndex)) {
      state.locks.delete(seatIndex);
    }
  }
  
  buildGrid();
  saveClassesToStorage();
}

// 그리드 차원 조절 핸들러
function updateGridDimensions(rows, cols) {
  state.rows = rows;
  state.cols = cols;
  
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
DOM.preset6x5.addEventListener('click', () => updateGridDimensions(5, 6));
DOM.preset5x6.addEventListener('click', () => updateGridDimensions(6, 5));

DOM.presetPairs.addEventListener('click', () => {
  state.rows = 5;
  state.cols = 8;
  state.disabledSeats.clear();
  for (let r = 0; r < state.rows; r++) {
    state.disabledSeats.add(r * state.cols + 2); // 3열 통로
    state.disabledSeats.add(r * state.cols + 5); // 6열 통로
  }
  updateGridDimensions(5, 8);
  showToast("3분단 짝꿍 배치가 완성되었습니다.");
});

DOM.presetUShape.addEventListener('click', () => {
  state.rows = 5;
  state.cols = 6;
  state.disabledSeats.clear();
  for (let r = 1; r < 4; r++) {
    for (let c = 1; c < 5; c++) {
      state.disabledSeats.add(r * state.cols + c);
    }
  }
  updateGridDimensions(5, 6);
  showToast("디귿자(U자)형 배치가 로드되었습니다.");
});

DOM.btnResetLayout.addEventListener('click', () => {
  state.disabledSeats.clear();
  state.locks.clear();
  state.assignment = [];
  buildGrid();
  saveClassesToStorage();
  showToast("레이아웃이 초기화되었습니다.");
});

DOM.gridRows.addEventListener('input', e => updateGridDimensions(parseInt(e.target.value), state.cols));
DOM.gridCols.addEventListener('input', e => updateGridDimensions(state.rows, parseInt(e.target.value)));


// ============================================================================
// 9. 대형 통합 탭 내비게이션 시스템
// ============================================================================
DOM.tabBtnSeating.addEventListener('click', () => switchMainTab('seating'));
DOM.tabBtnGroups.addEventListener('click', () => switchMainTab('groups'));
DOM.tabBtnPicker.addEventListener('click', () => switchMainTab('picker'));

function switchMainTab(tabName) {
  if (state.isShuffling) return; // 작업 중 차단
  
  state.activeTab = tabName;
  
  // 모든 탭 버튼 비활성화
  DOM.tabBtnSeating.classList.remove('active');
  DOM.tabBtnGroups.classList.remove('active');
  DOM.tabBtnPicker.classList.remove('active');
  
  // 모든 탭 뷰 감추기
  DOM.viewSeating.classList.remove('active');
  DOM.viewGroups.classList.remove('active');
  DOM.viewPicker.classList.remove('active');
  DOM.viewSeating.style.display = 'none';
  DOM.viewGroups.style.display = 'none';
  DOM.viewPicker.style.display = 'none';
  
  if (tabName === 'seating') {
    DOM.tabBtnSeating.classList.add('active');
    DOM.viewSeating.classList.add('active');
    DOM.viewSeating.style.display = 'flex';
    DOM.sidebarLayoutSettings.style.display = 'flex'; // 자리 설정 노출
  } else if (tabName === 'groups') {
    DOM.tabBtnGroups.classList.add('active');
    DOM.viewGroups.classList.add('active');
    DOM.viewGroups.style.display = 'flex';
    DOM.sidebarLayoutSettings.style.display = 'none'; // 자리 설정 숨김
    renderGroupsList();
  } else if (tabName === 'picker') {
    DOM.tabBtnPicker.classList.add('active');
    DOM.viewPicker.classList.add('active');
    DOM.viewPicker.style.display = 'flex';
    DOM.sidebarLayoutSettings.style.display = 'none'; // 자리 설정 숨김
    renderPickerList();
  }
}


// ============================================================================
// 10. 조 짜기 (모둠 편성) 비즈니스 로직
// ============================================================================

// 슬라이더 바인딩
DOM.groupSize.addEventListener('input', (e) => {
  state.targetGroupSize = parseInt(e.target.value);
  DOM.groupSizeVal.textContent = state.targetGroupSize;
});

// 균등 조 짜기 메인 함수
function runGroupShuffle() {
  if (state.isShuffling) return;
  
  const N = state.students.length;
  if (N === 0) {
    showToast("학생 명단을 먼저 기입하십시오.", "danger");
    return;
  }
  
  state.isShuffling = true;
  DOM.btnGroupShuffle.disabled = true;
  DOM.btnGroupSaveImage.disabled = true;
  DOM.btnGroupCopyText.disabled = true;
  
  // 오디오 초기화
  initAudio();
  
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
          ${members.map(m => `<li class="group-member-item">${m}</li>`).join('')}
        </ul>
      `;
      DOM.groupsBoard.appendChild(card);
    }
    
    tickCount++;
    if (tickCount >= 18) {
      clearInterval(state.shuffleInterval);
      completeGroupShuffle(groupSizes);
    }
  }, 100);
}

// 셔플 연출 정지 후 스마트 거리두기 제약 검증 엔진 구동
function completeGroupShuffle(groupSizes) {
  const result = solveGroupAssignment(groupSizes);
  
  state.lastGroupAssignment = result.groups;
  state.isShuffling = false;
  
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
        <p>명단을 입력하고 아래 [조 짜기 시작]을 누르세요!</p>
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
            <span>${m}</span>
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
  
  state.isShuffling = true;
  DOM.btnPickerStart.disabled = true;
  DOM.btnPickerCopyText.disabled = true;
  
  initAudio();
  
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
  
  state.isShuffling = false;
  
  // 결과물 렌더링
  DOM.pickerBoard.innerHTML = '';
  
  winners.forEach((winner, index) => {
    const ticket = document.createElement('div');
    ticket.className = 'picker-golden-ticket';
    // stager animation delay
    ticket.style.animationDelay = `${index * 0.2}s`;
    ticket.innerHTML = `
      <div class="picker-golden-ticket-inner">
        <span class="seat-index">당첨 티켓 #${index + 1}</span>
        <span class="student-name">${winner}</span>
      </div>
    `;
    DOM.pickerBoard.appendChild(ticket);
  });
  
  playSuccessSound();
  showToast(`🎉 랜덤으로 ${state.targetPickerCount}명의 학생이 성공적으로 뽑혔습니다!`);
  
  DOM.btnPickerStart.disabled = false;
  DOM.btnPickerCopyText.disabled = false;
  
  saveClassesToStorage();
}

function renderPickerList() {
  DOM.pickerBoard.innerHTML = '';
  
  if (!state.lastPickerAssignment || state.lastPickerAssignment.length === 0) {
    DOM.pickerBoard.innerHTML = `
      <div class="group-empty-placeholder" style="width: 100%;">
        <p>왼쪽에서 학생 명단을 등록하고 아래 [추첨 시작]을 누르세요!</p>
      </div>
    `;
    if (DOM.btnPickerCopyText) DOM.btnPickerCopyText.disabled = true;
    return;
  }
  
  state.lastPickerAssignment.forEach((winner, index) => {
    const ticket = document.createElement('div');
    ticket.className = 'picker-golden-ticket';
    ticket.style.animationDelay = `${index * 0.05}s`;
    ticket.innerHTML = `
      <div class="picker-golden-ticket-inner">
        <span class="seat-index">당첨 티켓 #${index + 1}</span>
        <span class="student-name">${winner}</span>
      </div>
    `;
    DOM.pickerBoard.appendChild(ticket);
  });
  
  if (DOM.btnPickerCopyText) DOM.btnPickerCopyText.disabled = false;
}

function copyPickerText() {
  if (state.isShuffling || !state.lastPickerAssignment || state.lastPickerAssignment.length === 0) return;
  
  let out = `🎲 [${state.activeClass} 랜덤 추첨 결과]\n`;
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
  
  const activeSeats = [];
  const totalSeats = state.rows * state.cols;
  for (let i = 0; i < totalSeats; i++) {
    if (!state.disabledSeats.has(i)) activeSeats.push(i);
  }
  
  if (state.students.length === 0) {
    showToast("학생 명단을 먼저 입력하세요.", "danger");
    return;
  }
  
  if (state.students.length > activeSeats.length) {
    showToast("활성화된 자리가 학생 수보다 부족합니다.", "danger");
    return;
  }
  
  state.isShuffling = true;
  DOM.btnShuffle.disabled = true;
  DOM.btnSaveImage.disabled = true;
  DOM.btnCopyText.disabled = true;
  
  initAudio();
  
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
      
      const lockedName = state.locks.get(idx);
      const isLockedValid = lockedName && state.students.includes(lockedName);
      
      // 관리자 모드가 활성화되어 있을 때만 셔플 중 고정 상태를 즉시 노출
      if (state.isSecretUnlocked && isLockedValid) {
        card.querySelector('.student-name').textContent = lockedName;
        card.classList.remove('shuffle-roll');
      } else {
        const randName = tempShuffled.pop();
        card.querySelector('.student-name').textContent = randName === '빈자리' ? 'X' : randName;
      }
    });
    
    tickCount++;
    if (tickCount >= 18) {
      clearInterval(state.shuffleInterval);
      completeShuffle(activeSeats);
    }
  }, 100);
}

function completeShuffle(activeSeats) {
  const result = solveSeatingAssignment(activeSeats);
  
  state.assignment = result.assignment;
  state.isShuffling = false;
  
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
  
  if (result.success) {
    showToast("성공적으로 자리 배치를 완료했습니다!");
  } else {
    showToast("자리 배치를 완료했습니다.", "success");
  }
  
  DOM.btnShuffle.disabled = false;
  DOM.btnSaveImage.disabled = false;
  DOM.btnCopyText.disabled = false;
  
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
  const lockedEntries = [];
  const lockedStudents = new Set();
  
  state.locks.forEach((name, seatIdx) => {
    if (state.students.includes(name) && activeSeats.includes(seatIdx)) {
      lockedEntries.push([seatIdx, name]);
      lockedStudents.add(name);
    }
  });
  
  const freeStudents = state.students.filter(name => !lockedStudents.has(name));
  const lockedSeatsSet = new Set(lockedEntries.map(e => e[0]));
  const freeSeats = activeSeats.filter(seatIdx => !lockedSeatsSet.has(seatIdx));
  
  const shuffledPool = [...freeStudents];
  while (shuffledPool.length < freeSeats.length) {
    shuffledPool.push('빈자리');
  }
  
  let bestAssignment = null;
  let minViolations = Infinity;
  const maxRetries = 400;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const tempPool = [...shuffledPool];
    shuffleArray(tempPool);
    
    const tempAssignment = new Array(state.rows * state.cols).fill(null);
    
    lockedEntries.forEach(([seatIdx, name]) => {
      tempAssignment[seatIdx] = name;
    });
    
    freeSeats.forEach((seatIdx, index) => {
      tempAssignment[seatIdx] = tempPool[index];
    });
    
    const violations = countSeparationViolations(tempAssignment);
    if (violations === 0) {
      return { success: true, assignment: tempAssignment };
    }
    
    if (violations < minViolations) {
      minViolations = violations;
      bestAssignment = tempAssignment;
    }
  }
  
  return { success: false, assignment: bestAssignment };
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

DOM.classSelect.addEventListener('change', (e) => {
  // 학급 전환 전에 현재 학급 정보를 임시 백업 보존
  captureCurrentClassState();
  
  const targetClass = e.target.value;
  loadClassData(targetClass);
  saveClassesToStorage();
  
  showToast(`[${targetClass}] 그룹이 성공적으로 로드되었습니다.`);
});

DOM.btnSaveClass.addEventListener('click', () => {
  const name = DOM.newClassName.value.trim();
  
  if (!name) {
    showToast("저장할 학급 이름을 입력해주세요.", "warning");
    return;
  }
  
  // 현재 활성화 상태 백업
  captureCurrentClassState();
  
  // 새 학급 정보 생성
  state.classes[name] = {
    studentsText: DOM.studentList.value,
    disabledSeats: new Set(state.disabledSeats),
    locks: new Map(state.locks),
    separatedPairs: [...state.separatedPairs],
    lastAssignment: [...state.assignment],
    lastGroupAssignment: [...state.lastGroupAssignment],
    rows: state.rows,
    cols: state.cols
  };
  
  state.activeClass = name;
  DOM.newClassName.value = '';
  
  populateClassSelectDropdown();
  saveClassesToStorage();
  loadClassData(name);
  
  showToast(`[${name}] 그룹이 성공적으로 신규 저장되었습니다!`);
});

DOM.btnDeleteClass.addEventListener('click', () => {
  const keys = Object.keys(state.classes);
  if (keys.length <= 1) {
    showToast("최소 한 개의 학급 그룹이 남아있어야 하므로 삭제할 수 없습니다.", "danger");
    return;
  }
  
  const toDelete = state.activeClass;
  
  if (confirm(`정말로 [${toDelete}] 그룹을 영구히 삭제하시겠습니까?`)) {
    delete state.classes[toDelete];
    
    // 남은 학급 중 첫 번째로 로드
    const remainingClass = Object.keys(state.classes)[0];
    state.activeClass = remainingClass;
    
    populateClassSelectDropdown();
    loadClassData(remainingClass);
    saveClassesToStorage();
    
    showToast(`[${toDelete}] 그룹이 성공적으로 영구 삭제되었습니다.`);
  }
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
  if (savedTheme === 'light') {
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
  const options = ['<option value="">-- 학생 선택 --</option>'];
  state.students.forEach(n => options.push(`<option value="${n}">${n}</option>`));
  const html = options.join('');
  if (DOM.sepStudent1) DOM.sepStudent1.innerHTML = html;
  if (DOM.sepStudent2) DOM.sepStudent2.innerHTML = html;
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
        <span><strong>${s1}</strong> &lt;&gt; <strong>${s2}</strong> (분리)</span>
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

// 1) 자리배치 내보내기
DOM.btnSaveImage.addEventListener('click', () => {
  if (state.isShuffling || state.assignment.length === 0) return;
  
  if (typeof html2canvas === 'undefined') {
    showToast("이미지 저장 라이브러리(html2canvas)를 가져오지 못했습니다. 인터넷망 연결 상태를 확인해주시거나, 오프라인 환경인 경우 html2canvas.min.js 파일을 다운로드하여 같은 폴더에 두고 불러와야 합니다.", "danger");
    return;
  }
  
  showToast("배치표 이미지를 캡처하고 있습니다...", "success");
  buildGrid(); // 핀 숨김 상태 강제 빌드
  
  document.body.classList.add('html2canvas-capturing');
  
  setTimeout(() => {
    try {
      const bg = state.theme === 'light' ? '#f4f6f9' : '#0a0a10';
      html2canvas(DOM.classroomCanvas, {
        backgroundColor: bg,
        scale: 2,
        logging: false,
        useCORS: true
      }).then(canvas => {
        document.body.classList.remove('html2canvas-capturing');
        const link = document.createElement('a');
        link.download = `자리배치결과_${state.activeClass}_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("자리 배치표가 다운로드되었습니다!");
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

DOM.btnCopyText.addEventListener('click', () => {
  if (state.isShuffling || state.assignment.length === 0) return;
  
  let out = `🏫 [${state.activeClass} 자리배치 결과]\n`;
  out += `앞 쪽 (교탁)\n`;
  out += `=======================\n`;
  for (let r = 0; r < state.rows; r++) {
    const names = [];
    for (let c = 0; c < state.cols; c++) {
      const idx = r * state.cols + c;
      if (state.disabledSeats.has(idx)) {
        names.push("[통로]");
      } else {
        const student = state.assignment[idx];
        names.push(student ? `[${student}]` : "[빈자리]");
      }
    }
    out += `${r + 1}열: ${names.join(' ')}\n`;
  }
  out += `=======================\n뒤 쪽`;
  
  navigator.clipboard.writeText(out).then(() => {
    showToast("배치 텍스트가 클립보드에 복사되었습니다!");
  });
});

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
      const bg = state.theme === 'light' ? '#f4f6f9' : '#0a0a10';
      html2canvas(DOM.groupCanvas, {
        backgroundColor: bg,
        scale: 2,
        logging: false,
        useCORS: true
      }).then(canvas => {
        document.body.classList.remove('html2canvas-capturing');
        const link = document.createElement('a');
        link.download = `모둠편성결과_${state.activeClass}_${new Date().toISOString().slice(0, 10)}.png`;
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
  
  let out = `👥 [${state.activeClass} 소그룹 조 편성표]\n`;
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
  const saved = localStorage.getItem('seat_arranger_classes_package');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state.classes = {};
      for (const name in parsed) {
        const cl = parsed[name];
        state.classes[name] = {
          studentsText: cl.studentsText,
          disabledSeats: new Set(cl.disabledSeats || []),
          locks: new Map(cl.locks || []),
          separatedPairs: cl.separatedPairs || [],
          lastAssignment: cl.lastAssignment || [],
          lastGroupAssignment: cl.lastGroupAssignment || [],
          lastPickerAssignment: cl.lastPickerAssignment || [],
          rows: cl.rows || 5,
          cols: cl.cols || 6
        };
      }
    } catch (e) {
      console.error(e);
      state.classes = loadDefaultClasses();
    }
  } else {
    state.classes = loadDefaultClasses();
  }
  
  // 마지막 활성화 학급 검출
  const lastActiveName = localStorage.getItem('seat_arranger_active_class_name');
  if (lastActiveName && state.classes[lastActiveName]) {
    state.activeClass = lastActiveName;
  } else {
    state.activeClass = Object.keys(state.classes)[0] || '1학년 1반 예시';
  }
}

function loadDefaultClasses() {
  const result = {};
  for (const name in DEFAULT_CLASSES) {
    const cl = DEFAULT_CLASSES[name];
    result[name] = {
      studentsText: cl.studentsText,
      disabledSeats: new Set(cl.disabledSeats),
      locks: new Map(cl.locks),
      separatedPairs: cl.separatedPairs,
      lastAssignment: cl.lastAssignment,
      lastGroupAssignment: cl.lastGroupAssignment,
      lastPickerAssignment: [],
      rows: cl.rows,
      cols: cl.cols
    };
  }
  return result;
}

function init() {
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
