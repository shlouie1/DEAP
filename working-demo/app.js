(function () {
  'use strict';

  var STORAGE_KEY = 'ktx-connect-demo-v2';
  var MAX_FOLLOW_UP_DAYS = 14;
  var MAX_WORKLIST_ITEMS = 5;
  var STATUS_OPTIONS = [
    { value: 'working', label: 'Working' },
    { value: 'not_working', label: 'Not working' },
    { value: 'adjust', label: 'Adjust follow-up' }
  ];

  // Routing roles follow the packet's barrier reference table. Staff names are fictional.
  var ROLES = {
    coordinator: { label: 'Transplant coordinator', escalate: false, staff: ['Alex Rivera (fictional)'] },
    prescriber: { label: 'Nephrologist, NP or pharmacist', escalate: true, staff: ['Dr. Kim Shah (fictional)'] },
    social: { label: 'Social worker', escalate: true, staff: ['Morgan Lee (fictional)'] },
    psych: { label: 'Psychologist', escalate: true, staff: ['Sam Okafor (fictional)'] }
  };

  // 14 checklist items: the Barriers Assessment Tool items from the KTx-CONNECT packet (b1-b14).
  // Items marked concerning are flagged even when both people agree.
  var BAT = [
    { id: 'b1', text: 'Forgetting to take them or bring them with you', action: 'Forgetting', role: 'coordinator' },
    { id: 'b2', text: 'Hate the taste', action: 'Taste', role: 'coordinator' },
    { id: 'b3', text: 'Hard to swallow pills', action: 'Pill swallowing', role: 'coordinator' },
    { id: 'b4', text: 'Side effects (e.g., nausea, constipation)', action: 'Side effects', role: 'coordinator' },
    { id: 'b5', text: "I don't want others to know I take medicine", action: 'Embarrassment', role: 'coordinator', concerning: true },
    { id: 'b6', text: "I don't need the medicine", action: 'Medication education', role: 'coordinator' },
    { id: 'b7', text: 'Too many medicines or too many times a day', action: 'Discussion', role: 'prescriber' },
    { id: 'b8', text: 'The medicine does not work', action: 'Discussion', role: 'prescriber' },
    { id: 'b9', text: 'Difficult to understand medication instructions', action: 'Discussion', role: 'prescriber' },
    { id: 'b10', text: 'Ran out of medicine', action: 'Referral', role: 'social', concerning: true },
    { id: 'b11', text: "Can't afford the medicine", action: 'Referral', role: 'social', concerning: true },
    { id: 'b12', text: 'Gets in the way of other activities', action: 'Referral', role: 'psych' },
    { id: 'b13', text: 'Refuse to take them', action: 'Referral', role: 'psych', concerning: true },
    { id: 'b14', text: 'Inconvenient', action: 'Referral', role: 'psych' }
  ];
  var BAT_BY_ID = {};
  BAT.forEach(function (b) { BAT_BY_ID[b.id] = b; });

  // Question wording per person. The patient answers about themselves; the caregiver answers about their child.
  // The coordinator and worklist use the neutral label in b.text. Ids and routing do not change.
  var WORDING = {
    b1: { patient: 'I forget to take my medicine or bring it with me', caregiver: 'My child forgets to take their medicine or bring it with them' },
    b2: { patient: 'I do not like the taste of my medicine', caregiver: 'My child does not like the taste of their medicine' },
    b3: { patient: 'I have a hard time swallowing my pills', caregiver: 'My child has a hard time swallowing pills' },
    b4: { patient: 'My medicine gives me side effects, like feeling sick or constipation', caregiver: 'The medicine gives my child side effects, like nausea or constipation' },
    b5: { patient: 'I do not want other people to know I take medicine', caregiver: 'My child does not want other people to know they take medicine' },
    b6: { patient: 'I feel I do not need this medicine', caregiver: 'My child feels they do not need this medicine' },
    b7: { patient: 'There are too many medicines, or too many times a day, to keep up with', caregiver: 'There are too many medicines, or too many times a day, for my child to keep up with' },
    b8: { patient: 'I think my medicine is not working', caregiver: "I think my child's medicine is not working" },
    b9: { patient: 'I do not understand how to take my medicine', caregiver: 'I do not understand how my child should take their medicine' },
    b10: { patient: 'I have run out of my medicine', caregiver: 'My child has run out of medicine' },
    b11: { patient: 'Money makes it hard for me to get or keep up with my medicine', caregiver: "Money makes it hard for us to get or keep up with my child's medicine" },
    b12: { patient: 'My medicine gets in the way of things I want to do', caregiver: "The medicine routine gets in the way of my child's activities" },
    b13: { patient: 'I sometimes do not want to take my medicine', caregiver: 'My child sometimes refuses to take their medicine' },
    b14: { patient: 'Taking my medicine is a hassle', caregiver: 'Taking the medicine is a hassle for our family' }
  };

  function wording(who, id) {
    var w = WORDING[id];
    return w ? w[who] : BAT_BY_ID[id].text;
  }

  // Answers: true = yes, false = no, null = not answered yet.
  function answers(values, fallback) {
    var out = {};
    BAT.forEach(function (b) {
      out[b.id] = values[b.id] !== undefined ? values[b.id] : fallback;
    });
    return out;
  }

  // Fictional sample data only. No real patient information.
  function seedData() {
    return {
      patient: { name: 'Maya (fictional, age 15)' },
      // Both check-ins start empty (null = not answered). Answers appear only after someone submits.
      patientAnswers: answers({}, null),
      caregiverAnswers: answers({}, null),
      owners: {},
      plan: null,
      // Check-ins alternate weekly and monthly, starting on this date.
      checkinStart: todayISO(),
      // Coordinator worklist items checked off, keyed by item.
      worklistDone: {}
    };
  }

  function isValidAnswers(a) {
    return !!a && typeof a === 'object' && BAT.every(function (b) {
      var v = a[b.id];
      // undefined is allowed so saved data from before the newer items still loads.
      return v === undefined || v === true || v === false || v === null;
    });
  }

  function isValidData(d) {
    return !!d && typeof d === 'object' &&
      !!d.patient && typeof d.patient.name === 'string' &&
      isValidAnswers(d.patientAnswers) && isValidAnswers(d.caregiverAnswers) &&
      !!d.owners && typeof d.owners === 'object' &&
      (d.plan === null || (typeof d.plan === 'object' && !!BAT_BY_ID[d.plan.barrierId] &&
        typeof d.plan.actionPlan === 'string' && typeof d.plan.text === 'string' &&
        typeof d.plan.followUpDue === 'string' &&
        (d.plan.followUpState === null || typeof d.plan.followUpState === 'string')));
  }

  function loadData() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (isValidData(parsed)) return parsed;
      }
    } catch (err) {
      // Corrupt or blocked storage: fall back to the fictional seed data.
    }
    return seedData();
  }

  // Fill in fields added after a version was saved, so older saved data still loads.
  function normalize(d) {
    if (typeof d.checkinStart !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d.checkinStart)) {
      d.checkinStart = todayISO();
    }
    if (!d.worklistDone || typeof d.worklistDone !== 'object') d.worklistDone = {};
    // Fill in answers for items added after this data was saved (unanswered = null).
    ['patientAnswers', 'caregiverAnswers'].forEach(function (k) {
      BAT.forEach(function (b) {
        if (d[k][b.id] === undefined) d[k][b.id] = null;
      });
    });
    return d;
  }

  var state = normalize(loadData());

  function saveData() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (err) {
      return false;
    }
  }

  var currentView = 'coordinator';
  var message = null;

  // Date helpers use local calendar dates (YYYY-MM-DD).
  function toISO(d) {
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')
    ].join('-');
  }

  function todayISO() {
    return toISO(new Date());
  }

  function addDays(iso, days) {
    var parts = iso.split('-').map(Number);
    return toISO(new Date(parts[0], parts[1] - 1, parts[2] + days));
  }

  function formatDate(iso) {
    var parts = iso.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  function isValidDue(due) {
    return !!due && due >= todayISO() && due <= addDays(todayISO(), MAX_FOLLOW_UP_DAYS);
  }

  // DOM helper: text is always inserted with textContent, never as HTML.
  function h(tag, attrs) {
    var node = document.createElement(tag);
    var children = Array.prototype.slice.call(arguments, 2);
    Object.keys(attrs || {}).forEach(function (key) {
      var value = attrs[key];
      if (value === undefined || value === null || value === false) return;
      if (key === 'className') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'value' && tag === 'textarea') node.value = value;
      else if (key.indexOf('on') === 0 && typeof value === 'function') {
        node.addEventListener(key.slice(2), value);
      } else if (value === true) node.setAttribute(key, '');
      else node.setAttribute(key, String(value));
    });
    children.forEach(function (child) {
      if (child === undefined || child === null || child === false) return;
      if (Array.isArray(child)) {
        child.forEach(function (c) { if (c) node.append(c); });
      } else {
        node.append(child instanceof Node ? child : document.createTextNode(String(child)));
      }
    });
    return node;
  }

  function setMessage(type, text) {
    message = { type: type, text: text };
  }

  function persist(successText) {
    if (saveData()) {
      setMessage('ok', successText);
    } else {
      setMessage('error', 'Could not save in this browser. Your latest change may be lost on refresh.');
    }
    render();
  }

  // Routing: each barrier gets one owner (fictional staff from its routed role).
  function ownerFor(barrierId) {
    var barrier = BAT_BY_ID[barrierId];
    var role = ROLES[barrier.role];
    return state.owners[barrierId] || role.staff[0];
  }

  // A barrier is "disagreed" when patient and caregiver answers differ (both answered).
  function isDisagreement(id) {
    var p = state.patientAnswers[id];
    var c = state.caregiverAnswers[id];
    return p !== null && c !== null && p !== c;
  }

  // Yes from either person means the barrier is present.
  function isFlagged(id) {
    return state.patientAnswers[id] === true || state.caregiverAnswers[id] === true;
  }

  // Coordinator worklist: short and actionable. Patient private answers are never named as text.
  function buildWorklist() {
    var items = [];
    var today = todayISO();
    var plan = state.plan;
    // Each item gets a stable key so its checkbox state can be saved.
    function add(key, text, priority) { items.push({ key: key, text: text, priority: priority }); }

    if (plan) {
      var barrier = BAT_BY_ID[plan.barrierId];
      var name = barrier.action;
      if (plan.followUpState === 'not_working') {
        add('plan-not-working', 'Plan not working (' + name + '): adjust it and set a new follow-up date.', 1);
      } else if (plan.followUpState === 'adjust') {
        add('plan-adjust', 'Adjust follow-up (' + name + '): set a new date within ' + MAX_FOLLOW_UP_DAYS + ' days.', 1);
      } else if (!plan.followUpState) {
        if (plan.followUpDue < today) {
          add('plan-overdue', 'Overdue follow-up (' + formatDate(plan.followUpDue) + '): record Working / Not working / Adjust.', 0);
        } else {
          add('plan-due', 'Follow-up due ' + formatDate(plan.followUpDue) + ': record Working / Not working / Adjust.', 2);
        }
      }
    }

    // Concerning items are flagged whenever either person says Yes, even if both agree.
    // The worklist never says which person answered.
    BAT.forEach(function (b) {
      if (!isFlagged(b.id)) return;
      if (b.concerning) {
        var both = state.patientAnswers[b.id] === true && state.caregiverAnswers[b.id] === true;
        add('concern-' + b.id,
          (both ? 'Concern, both agree: ' : 'Concern: ') + b.text + '. Route to ' + ROLES[b.role].label + '.',
          both ? 0 : 1);
        return;
      }
      if (ROLES[b.role].escalate) {
        add('escalate-' + b.id, 'Escalate to ' + ROLES[b.role].label + ': ' + b.text + '.', 1);
      }
    });

    BAT.forEach(function (b) {
      if (isDisagreement(b.id)) {
        add('disagree-' + b.id, 'Patient and caregiver disagree: ' + b.text + '. Discuss at next check-in.', 2);
      }
    });

    if (!plan) {
      add('agree-plan', 'Agree on one plan for a flagged barrier.', 3);
    }

    var missing = BAT.filter(function (b) {
      return state.patientAnswers[b.id] === null || state.caregiverAnswers[b.id] === null;
    });
    if (missing.length) {
      add('incomplete', 'Checklist incomplete: ' + missing.length + ' item(s) still unanswered by one person.', 4);
    }

    items.sort(function (a, b) { return a.priority - b.priority; });
    return items;
  }

  // Check-in schedule: alternates weekly and monthly from checkinStart.
  // Cycle 0 is the first check-in (weekly), cycle 1 is monthly, and so on.
  function checkinSchedule(count) {
    var out = [];
    var start = state.checkinStart;
    var cursor = start;
    var today = todayISO();
    for (var i = 0; i < count; i++) {
      var weekly = i % 2 === 0;
      var end = weekly ? addDays(cursor, 6) : addDays(cursor, 27);
      out.push({
        index: i,
        kind: weekly ? 'Weekly' : 'Monthly',
        from: cursor,
        to: end,
        current: today >= cursor && today <= end,
        past: end < today
      });
      cursor = addDays(end, 1);
    }
    return out;
  }

  // Schedule shows only the current check-in by default. "Show all" reveals the rest.
  var scheduleExpanded = false;

  function renderScheduleCard() {
    var rows = checkinSchedule(6);
    var current = rows.filter(function (r) { return r.current; })[0] || rows[0];
    var visible = scheduleExpanded ? rows : [current];
    return h('section', { className: 'card schedule-card', 'aria-labelledby': 'schedule-title' },
      h('h2', { id: 'schedule-title', 'data-eyebrow': 'Check-ins', text: 'Check-in schedule' }),
      h('ul', { className: 'schedule' },
        visible.map(function (r) {
          var status = r.current ? 'Current' : r.past ? 'Past' : 'Upcoming';
          return h('li', { className: 'schedule-row' + (r.current ? ' current' : '') },
            h('span', { className: 'schedule-kind', text: r.kind }),
            h('span', { className: 'schedule-dates', text: formatDate(r.from) + ' to ' + formatDate(r.to) }),
            h('span', { className: 'muted small', text: status })
          );
        })
      ),
      h('button', {
        type: 'button', className: 'btn btn-quiet schedule-toggle',
        'aria-expanded': scheduleExpanded ? 'true' : 'false',
        onclick: function () {
          scheduleExpanded = !scheduleExpanded;
          render();
        }
      }, scheduleExpanded ? 'Show current only' : 'Show all check-ins')
    );
  }

  function hr() {
    return h('hr', { className: 'section-rule' });
  }

  // Unsaved checklist answers, kept in memory across view switches. Cleared on save.
  var drafts = { patient: {}, caregiver: {} };

  function currentAnswer(who, id) {
    var saved = who === 'patient' ? state.patientAnswers[id] : state.caregiverAnswers[id];
    return drafts[who][id] !== undefined ? drafts[who][id] : saved;
  }

  // Checklist collapses once every item is saved, like the coordinator's schedule.
  // expanded[who] is a per-session override: true = user chose to show it, false = user chose to hide it.
  // Undefined means "follow the saved answers", so the collapse also holds after a reload.
  var checklistExpanded = {};

  function completedCount(who) {
    var saved = who === 'patient' ? state.patientAnswers : state.caregiverAnswers;
    return BAT.filter(function (b) { return saved[b.id] === true || saved[b.id] === false; }).length;
  }

  function renderChecklist(who, title) {
    var prefix = who + '-';
    var answered = completedCount(who);
    var complete = answered === BAT.length;
    var collapsed = complete && checklistExpanded[who] !== true;
    if (collapsed) {
      return h('section', { className: 'card checklist-collapsed', 'aria-labelledby': who + '-checklist-title' },
        h('h2', { id: who + '-checklist-title', 'data-eyebrow': 'Check-in', text: title }),
        h('p', { className: 'muted', text: 'Checklist complete. Thank you for checking in.' }),
        h('button', {
          type: 'button', className: 'btn btn-quiet checklist-toggle',
          'aria-expanded': 'false',
          onclick: function () {
            checklistExpanded[who] = true;
            render();
          }
        }, 'Show checklist')
      );
    }
    var items = BAT.map(function (b) {
      var current = currentAnswer(who, b.id);
      return h('fieldset', { className: 'bat-item' },
        h('legend', { text: wording(who, b.id) }),
        h('div', { className: 'yn-group' },
          [['Yes', true], ['No', false]].map(function (pair) {
            var id = prefix + b.id + '-' + pair[0];
            return h('span', { className: 'yn-option' },
              h('input', {
                type: 'radio', id: id, name: prefix + b.id, value: String(pair[1]),
                checked: current === pair[1],
                onchange: function () { drafts[who][b.id] = pair[1]; }
              }),
              h('label', { 'for': id, text: pair[0] })
            );
          })
        )
      );
    });

    return h('section', { className: 'card', 'aria-labelledby': who + '-checklist-title' },
      h('h2', { id: who + '-checklist-title', 'data-eyebrow': 'Check-in', text: title }),
      h('p', { className: 'muted small', text: 'Answer each item yourself. Your answers are saved separately from the other person\'s.' }),
      h('form', {
        onsubmit: function (event) {
          event.preventDefault();
          var target = who === 'patient' ? state.patientAnswers : state.caregiverAnswers;
          BAT.forEach(function (b) {
            var value = currentAnswer(who, b.id);
            if (value === null || value === undefined) value = null;
            target[b.id] = value;
          });
          drafts[who] = {};
          // Saving starts from the saved answers again: complete collapses, partial stays open.
          delete checklistExpanded[who];
          persist('Your checklist was saved in this browser.');
        }
      },
        items,
        h('button', { type: 'submit', className: 'btn btn-primary' }, 'Save checklist'),
        answered === BAT.length ? h('button', {
          type: 'button', className: 'btn btn-quiet checklist-toggle',
          'aria-expanded': 'true',
          onclick: function () {
            checklistExpanded[who] = false;
            render();
          }
        }, 'Hide checklist') : null
      )
    );
  }

  // Unsaved step edits for the coordinator's outline. Only "Save plan" writes them to the plan.
  var planDraft = null;

  // Agreed plan: an editable bullet list. Coordinator can edit the bullets; others see them read-only.
  function renderPlanCard(options) {
    var plan = state.plan;
    var editable = !!(options && options.coordinator);
    var card = h('section', { className: 'card', 'aria-labelledby': 'plan-title' },
      h('h2', { id: 'plan-title', 'data-eyebrow': 'Plan', text: 'Agreed plan' }));
    if (!plan) {
      // Prefer a flagged barrier; otherwise start from the first barrier so the coordinator can still begin a plan.
      var flaggedIds = BAT.filter(function (b) { return isFlagged(b.id); });
      var startBarrier = flaggedIds[0] || BAT[0];
      card.append(h('p', { className: 'notice notice-ok', text: 'No action needed!' }));
      if (editable) {
        card.append(h('button', {
          type: 'button', className: 'btn btn-primary',
          onclick: function () {
            planDraft = null;
            state.plan = {
              barrierId: startBarrier.id,
              actionPlan: startBarrier.action,
              text: '',
              bullets: [''],
              followUpDue: addDays(todayISO(), MAX_FOLLOW_UP_DAYS),
              followUpState: null
            };
            persist('Plan outline started for "' + startBarrier.action + '". Add bullets and fill in the text.');
          }
        }, 'Start plan outline'));
      }
      return card;
    }
    var barrier = BAT_BY_ID[plan.barrierId];
    var overdue = plan.followUpDue < todayISO() && !plan.followUpState;

    var saved = (plan.bullets && plan.bullets.length) ? plan.bullets : [plan.text || ''];
    if (editable && planDraft === null) planDraft = saved.slice();
    var bullets = editable ? planDraft : saved;
    card.append(
      h('ul', { className: 'plan-bullets' },
        h('li', null, h('strong', { text: 'Barrier: ' }), barrier.text),
        h('li', null, h('strong', { text: 'Action plan: ' }), barrier.action),
        h('li', null, h('strong', { text: 'Owner: ' }), ownerFor(plan.barrierId)),
        h('li', null, h('strong', { text: 'Follow-up due: ' }), formatDate(plan.followUpDue),
          overdue ? h('span', { className: 'action', text: ' (overdue)' }) : null)
      ),
      h('p', { className: 'plan-steps-label', text: 'Steps:' }),
      editable
        ? renderEditableBullets(bullets)
        : h('ul', { className: 'plan-bullets plan-steps' }, bullets.map(function (t) {
            return h('li', { text: t });
          }))
    );
    if (editable) {
      card.append(
        hr(),
        h('p', { className: 'muted small', text: 'Follow-up status:' }),
        h('div', { className: 'status-buttons', role: 'group', 'aria-label': 'Follow-up status' },
          STATUS_OPTIONS.map(function (option) {
            var active = plan.followUpState === option.value;
            return h('button', {
              type: 'button', className: 'btn',
              'aria-pressed': active ? 'true' : 'false',
              onclick: function () {
                plan.followUpState = option.value;
                persist('Follow-up marked "' + option.label + '".');
              }
            }, option.label);
          })
        ),
        renderFollowUpDateForm()
      );
    }
    return card;
  }

  // Editable outline. Typing updates the draft only. Add and Remove change the draft and redraw.
  // Blank rows stay in the draft while editing and are dropped only when the plan is saved.
  function renderEditableBullets(bullets) {
    var list = h('ul', { className: 'plan-bullets plan-steps' });
    bullets.forEach(function (text, idx) {
      list.append(h('li', { className: 'plan-step' },
        h('input', {
          type: 'text', 'aria-label': 'Step ' + (idx + 1), value: text, maxlength: 200,
          className: 'plan-step-input', placeholder: 'Type a step',
          oninput: function (event) { bullets[idx] = event.target.value; }
        }),
        h('button', {
          type: 'button', className: 'btn btn-quiet plan-step-remove',
          'aria-label': 'Remove step ' + (idx + 1),
          onclick: function () {
            bullets.splice(idx, 1);
            if (bullets.length === 0) bullets.push('');
            render();
          }
        }, 'Remove')
      ));
    });
    return h('div', null,
      list,
      h('div', { className: 'plan-actions' },
        h('button', {
          type: 'button', className: 'btn',
          onclick: function () {
            bullets.push('');
            render();
            var inputs = document.querySelectorAll('.plan-step-input');
            if (inputs.length) inputs[inputs.length - 1].focus();
          }
        }, 'Add step'),
        h('button', {
          type: 'button', className: 'btn btn-primary',
          onclick: function () { savePlanBullets(bullets); }
        }, 'Save plan')
      )
    );
  }

  function savePlanBullets(bullets) {
    var cleaned = bullets.map(function (t) { return String(t).trim(); }).filter(Boolean).slice(0, 10);
    if (cleaned.length === 0) {
      setMessage('error', 'Type at least one step before saving.');
      return render();
    }
    state.plan.bullets = cleaned;
    state.plan.text = cleaned.join('; ');
    planDraft = null;
    persist('Plan saved.');
  }

  function renderFollowUpDateForm() {
    var today = todayISO();
    var max = addDays(today, MAX_FOLLOW_UP_DAYS);
    return h('form', {
      onsubmit: function (event) {
        event.preventDefault();
        var due = event.currentTarget.elements['followup-due'].value;
        if (!isValidDue(due)) {
          setMessage('error', 'Follow-up must be today or within ' + MAX_FOLLOW_UP_DAYS + ' days.');
          return render();
        }
        state.plan.followUpDue = due;
        state.plan.followUpState = null;
        persist('New follow-up date saved: ' + formatDate(due) + '.');
      }
    },
      h('label', null, 'Set a new follow-up date',
        h('input', { type: 'date', name: 'followup-due', required: true, value: max, min: today, max: max })
      ),
      h('button', { type: 'submit', className: 'btn' }, 'Save new follow-up date')
    );
  }

  // Coordinator: worklist, both answer sets side by side with disagreements marked, and the plan.
  // Shows barrier names and flags only. Owner names come from routing, not from the teen's answers.
  // Worklist item checkboxes. Checked items are saved, and keep their state across reloads.
  function renderWorklistCard() {
    var items = buildWorklist();
    var shown = items.slice(0, MAX_WORKLIST_ITEMS);
    var extra = items.length - shown.length;
    return h('section', { className: 'card worklist-card', 'aria-labelledby': 'worklist-title' },
      h('h2', { id: 'worklist-title', 'data-eyebrow': 'Coordinator', text: 'Coordinator worklist' }),
      items.length === 0
        ? h('p', { className: 'muted', text: 'Nothing needs action right now.' })
        : h('ol', { className: 'worklist' },
            shown.map(function (item) {
              var key = item.key;
              var done = !!state.worklistDone[key];
              var id = 'wl-' + key.replace(/[^a-z0-9]/gi, '-');
              return h('li', { className: 'worklist-item' + (done ? ' done' : '') },
                h('input', {
                  type: 'checkbox', id: id, checked: done,
                  onchange: function (event) {
                    state.worklistDone[key] = event.target.checked;
                    persist(event.target.checked ? 'Marked done.' : 'Marked not done.');
                  }
                }),
                h('label', { 'for': id, className: 'action', text: item.text }));
            }),
            extra > 0 ? h('li', { className: 'muted small', text: '+' + extra + ' more item(s) not shown.' }) : null
          )
    );
  }

  // Areas of concern: any concerning item answered Yes by either person, whether or not they agree.
  // Names the item only. It never says which person answered.
  function renderConcernCard() {
    var concerns = BAT.filter(function (b) { return b.concerning && isFlagged(b.id); });
    return h('section', { className: 'card', 'aria-labelledby': 'concern-title' },
      h('h2', { id: 'concern-title', 'data-eyebrow': 'Concerns', text: 'Areas of concern' }),
      concerns.length === 0
        ? h('p', { className: 'notice notice-ok', text: "We're good here. No answers of concern." })
        : h('ul', { className: 'bat-summary' },
            concerns.map(function (b) {
              var both = state.patientAnswers[b.id] === true && state.caregiverAnswers[b.id] === true;
              return h('li', { className: 'bat-row disagree' },
                h('span', { className: 'bat-text', text: b.text }),
                h('span', { className: 'bat-answers' },
                  h('span', { className: 'muted small', text: both ? 'Both agree' : 'Reported by one person' }),
                  h('span', { className: 'muted small', text: ' · Routes to ' + ROLES[b.role].label })
                )
              );
            })
          )
    );
  }

  // Only barriers where patient and caregiver disagree. Shows "We're good here" if none.
  function renderDisagreementCard() {
    var disagreed = BAT.filter(function (b) { return isDisagreement(b.id); });
    return h('section', { className: 'card', 'aria-labelledby': 'disagree-title' },
      h('h2', { id: 'disagree-title', 'data-eyebrow': 'Disagreements', text: 'Where patient and caregiver disagree' }),
      disagreed.length === 0
        ? h('p', { className: 'notice notice-ok', text: "We're good here. No disagreements between the patient and caregiver." })
        : h('ul', { className: 'bat-summary' },
            disagreed.map(function (b) {
              return h('li', { className: 'bat-row disagree' },
                h('span', { className: 'bat-text', text: b.text }),
                h('span', { className: 'bat-answers' },
                  h('span', { text: 'Patient: ' + answerLabel(state.patientAnswers[b.id]) }), ' · ',
                  h('span', { text: 'Caregiver: ' + answerLabel(state.caregiverAnswers[b.id]) }),
                  h('span', { className: 'muted small', text: ' · Owner: ' + ownerFor(b.id) })
                )
              );
            })
          )
    );
  }

  function answerLabel(v) {
    return v === true ? 'Yes' : v === false ? 'No' : 'Not answered';
  }

  // Left column: schedule (current only), rule, worklist. Right column: disagreements, plan.
  function renderCoordinator() {
    return [
      h('div', { className: 'coordinator-grid' },
        h('div', { className: 'coordinator-left' },
          renderScheduleCard(),
          hr(),
          renderWorklistCard()),
        h('div', { className: 'coordinator-right' },
          renderConcernCard(),
          hr(),
          renderDisagreementCard(),
          hr(),
          renderPlanCard({ coordinator: true }))
      )
    ];
  }

  // Patient view: only the patient's own checklist and the shared plan. Caregiver answers are never read here.
  function renderPatient() {
    return [
      renderChecklist('patient', 'Your check-in'),
      renderPlanCard({ coordinator: false })
    ];
  }

  // Caregiver view: only the caregiver's own checklist and the shared plan. Patient answers are never read here.
  function renderCaregiver() {
    return [
      renderChecklist('caregiver', 'Caregiver check-in'),
      renderPlanCard({ coordinator: false })
    ];
  }

  function renderViewSwitcher() {
    var views = [
      { id: 'coordinator', label: 'Coordinator' },
      { id: 'patient', label: 'Patient check-in' },
      { id: 'caregiver', label: 'Caregiver check-in' }
    ];
    return h('nav', { className: 'role-nav', 'aria-label': 'Views' },
      views.map(function (view) {
        var active = currentView === view.id;
        return h('button', {
          type: 'button', className: 'btn',
          'aria-pressed': active ? 'true' : 'false',
          onclick: function () {
            currentView = view.id;
            message = null;
            render();
          }
        }, view.label);
      }),
      h('button', {
        type: 'button', className: 'btn btn-quiet',
        onclick: function () {
          if (!window.confirm('Reset all fictional demo data in this browser?')) return;
          state = seedData();
          drafts = { patient: {}, caregiver: {} };
          planDraft = null;
          currentView = 'coordinator';
          persist('Demo data reset to the sample case.');
        }
      }, 'Reset demo data')
    );
  }

  function render() {
    var app = document.getElementById('app');
    if (!app) return;
    var body;
    if (currentView === 'patient') body = renderPatient();
    else if (currentView === 'caregiver') body = renderCaregiver();
    else body = renderCoordinator();

    // Flatten so replaceChildren receives real nodes only.
    var children = [
      h('header', { className: 'app-header' },
        h('h1', null, h('span', { text: 'KTx-CONNECT' }), ' Demo'),
        h('p', { className: 'muted small', text: 'Fictional sample data only. Saved in this browser (localStorage). Not clinical advice.' })
      ),
      renderViewSwitcher(),
      message ? h('p', {
        className: message.type === 'error' ? 'notice notice-error' : 'notice notice-ok', role: 'status'
      }, message.text) : null
    ].concat(body).filter(function (node) { return node instanceof Node; });
    app.replaceChildren.apply(app, children);
  }

  render();
})();
