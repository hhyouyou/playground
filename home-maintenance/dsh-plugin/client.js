window.__ModuleLoader__.load({
  id: '@local/dsh-home-maintenance',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useMemo, useState } = React
    const NS = 'homeMaintenance'
    const PANEL_ID = 'home-maintenance'
    const STORAGE_KEY = '@local/dsh-home-maintenance:v1'

    const zh = {
      panel: '家庭维护', title: '家庭维护', subtitle: '把周期家务和设备维护，安排在清新的日常里。',
      heroDue: '今天有 {count} 项维护', heroClear: '今天没有到期任务', heroEmpty: '先完善维护记录',
      heroDueText: '已到建议时间，其他项目可在下方查看。', heroClearText: '所有已记录项目都在周期内，保持得不错。', heroEmptyText: '点击任务卡片的设置，补填上次完成日期即可开始计算。',
      recordFirst: '记录「{name}」', fillLastDate: '填写上次完成日期', addTask: '添加维护任务', dueBadge: '项待处理', tasks: '维护项目', autoCalculated: '按实际完成日期自动计算',
      taskFilterClean: '清洁滤芯', taskTankClean: '清洁水箱和机身', taskPump: '水泵除垢', taskFilterReplace: '更换滤芯',
      everyDays: '每 {days} 天', lastClean: '上次清理 · {date}', lastReplace: '上次更换 · {date}', neverRecorded: '尚未记录完成日期',
      cleanToday: '今天清理', replaceToday: '今天更换', overdueClean: '需要及时清理', overdueReplace: '需要及时更换',
      daysLater: '{days} 天后清理', daysLaterReplace: '{days} 天后更换', tomorrow: '明天到期', unrecorded: '待记录', futureDate: '日期待确认',
      recordClean: '今天已清理', recordReplace: '今天已更换', settings: '设置', closeSettings: '收起设置',
      intervalDays: '提醒周期（天）', lastDoneDate: '上次完成日期', saveSettings: '保存设置', deleteTask: '删除任务', cancel: '取消',
      confirmDelete: '确定删除「{name}」吗？此操作会同时删除它的完成记录。', invalidTask: '请填写任务名称，并输入 1～730 天的有效周期。', invalidDate: '上次完成日期不能晚于今天。',
      customTask: '新增周期任务', taskName: '任务名称', taskNamePlaceholder: '例如：拖地、整理冰箱', taskType: '任务类型', typeClean: '清理', typeReplace: '更换', createTask: '创建任务',
      recorded: '已记录「{name}」', added: '已添加「{name}」', deleted: '已删除「{name}」', updated: '设置已保存', notPersisted: '更改已在本页生效，但浏览器未能保存。', undo: '撤销', undone: '已撤销上次记录', storageError: '浏览器存储不可用或数据异常，本次更改可能无法在关闭后保留。',
      calendar: '维护日历', calendarHint: '点击日期查看当天安排', previousMonth: '上个月', nextMonth: '下个月', backToday: '回到今天',
      selectedDate: '选中日期', noEvents: '这一天没有维护安排', upcoming: '接下来', upcomingHint: '近期维护安排', noUpcoming: '补填上次完成日期后，这里会显示近期安排。',
      done: '已完成', plannedClean: '计划清理', plannedReplace: '计划更换', dueClean: '需要清理', dueReplace: '需要更换',
      legendDone: '已完成', legendDue: '待处理', legendReplace: '更换任务',
      weekday0: '周日', weekday1: '周一', weekday2: '周二', weekday3: '周三', weekday4: '周四', weekday5: '周五', weekday6: '周六',
      guideTitle: '维护说明与数据存储', guideFilter: '滤芯建议每周清洁，水温不超过 40℃，不可烘干；装回时确保平整服帖。', guideTank: '水箱和机身建议每周清洁，倒出水箱余水并用软布擦干外侧及下耦合器。', guidePump: '水泵除垢可参考 1 升水加 20 克柠檬酸除垢剂，具体以产品说明为准。',
      localOnly: '记录仅保存在当前浏览器和当前 DSH 地址；清除网站数据会删除记录，不同浏览器或地址不共享。本版本不包含后台通知、智能家居接入或设备控制。',
    }

    const en = {
      panel: 'Home maintenance', title: 'Home maintenance', subtitle: 'Keep recurring chores and device care comfortably on schedule.',
      heroDue: '{count} task(s) due today', heroClear: 'Nothing is due today', heroEmpty: 'Complete your maintenance records',
      heroDueText: 'has reached its suggested interval. See the cards below for everything else.', heroClearText: 'All recorded tasks are within their intervals. Looking good.', heroEmptyText: 'Open a task card’s settings and add its last completion date to start the schedule.',
      recordFirst: 'Record “{name}”', fillLastDate: 'Add last completion date', addTask: 'Add maintenance task', dueBadge: 'due', tasks: 'Maintenance tasks', autoCalculated: 'Calculated from actual completion dates',
      taskFilterClean: 'Clean humidifier filter', taskTankClean: 'Clean tank and body', taskPump: 'Descale water pump', taskFilterReplace: 'Replace filter',
      everyDays: 'Every {days} days', lastClean: 'Last cleaned · {date}', lastReplace: 'Last replaced · {date}', neverRecorded: 'No completion date recorded',
      cleanToday: 'Clean today', replaceToday: 'Replace today', overdueClean: 'Cleaning needed', overdueReplace: 'Replacement needed',
      daysLater: 'Clean in {days} days', daysLaterReplace: 'Replace in {days} days', tomorrow: 'Due tomorrow', unrecorded: 'Needs date', futureDate: 'Check date',
      recordClean: 'Cleaned today', recordReplace: 'Replaced today', settings: 'Settings', closeSettings: 'Close settings',
      intervalDays: 'Reminder interval (days)', lastDoneDate: 'Last completion date', saveSettings: 'Save settings', deleteTask: 'Delete task', cancel: 'Cancel',
      confirmDelete: 'Delete “{name}”? This also removes its completion history.', invalidTask: 'Enter a task name and an interval from 1 to 730 days.', invalidDate: 'The last completion date cannot be in the future.',
      customTask: 'New recurring task', taskName: 'Task name', taskNamePlaceholder: 'For example: mop floors', taskType: 'Task type', typeClean: 'Cleaning', typeReplace: 'Replacement', createTask: 'Create task',
      recorded: 'Recorded “{name}”', added: 'Added “{name}”', deleted: 'Deleted “{name}”', updated: 'Settings saved', notPersisted: 'The change is active on this page, but the browser could not save it.', undo: 'Undo', undone: 'Last record undone', storageError: 'Browser storage is unavailable or its data could not be read; changes may not survive after closing.',
      calendar: 'Maintenance calendar', calendarHint: 'Select a date to see its schedule', previousMonth: 'Previous month', nextMonth: 'Next month', backToday: 'Today',
      selectedDate: 'Selected date', noEvents: 'No maintenance is scheduled for this date', upcoming: 'Coming up', upcomingHint: 'Upcoming maintenance', noUpcoming: 'Add a last completion date to see upcoming maintenance.',
      done: 'Completed', plannedClean: 'Cleaning planned', plannedReplace: 'Replacement planned', dueClean: 'Cleaning due', dueReplace: 'Replacement due',
      legendDone: 'Completed', legendDue: 'Due', legendReplace: 'Replacement',
      weekday0: 'Sun', weekday1: 'Mon', weekday2: 'Tue', weekday3: 'Wed', weekday4: 'Thu', weekday5: 'Fri', weekday6: 'Sat',
      guideTitle: 'Maintenance notes and data storage', guideFilter: 'Clean the humidifier filter weekly with water no hotter than 40°C. Do not tumble dry; reinstall it flat and secure.', guideTank: 'Empty and rinse the tank weekly, then wipe its exterior and lower coupler with a soft cloth.', guidePump: 'For descaling, the reference ratio is 20 g citric acid descaler per litre of water; follow the product instructions.',
      localOnly: 'Records stay in this browser and DSH origin. Clearing site data deletes them; other browsers and origins do not share them. Background notifications, smart-home integrations, and device control are not included.',
    }

    const DEFAULT_TASKS = [
      { id: 'humidifier-filter-clean', nameKey: 'taskFilterClean', days: 7, kind: 'clean', icon: 'drop', builtIn: true },
      { id: 'humidifier-tank-clean', nameKey: 'taskTankClean', days: 7, kind: 'clean', icon: 'tank', builtIn: true },
      { id: 'humidifier-pump-descale', nameKey: 'taskPump', days: 30, kind: 'clean', icon: 'pump', builtIn: true },
      { id: 'humidifier-filter-replace', nameKey: 'taskFilterReplace', days: 180, kind: 'replace', icon: 'filter', builtIn: true },
    ]
    const ICON_NAMES = new Set(['drop', 'tank', 'pump', 'filter', 'home'])

    function defaults() {
      return DEFAULT_TASKS.map(task => ({ ...task, lastDone: '', history: [] }))
    }

    function validDate(value) {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
      const date = parseDate(value)
      return !Number.isNaN(date.getTime()) && dateString(date) === value
    }

    function parseDate(value) {
      const [year, month, day] = value.split('-').map(Number)
      return new Date(year, month - 1, day, 12)
    }

    function dateString(date) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    }

    function todayString() {
      return dateString(new Date())
    }

    function addDays(value, days) {
      const date = parseDate(value)
      date.setDate(date.getDate() + days)
      return dateString(date)
    }

    function daysBetween(from, to) {
      return Math.round((parseDate(to) - parseDate(from)) / 86400000)
    }

    function validDays(value) {
      const number = Number(value)
      return Number.isInteger(number) && number >= 1 && number <= 730
    }

    function sanitizeTask(task, builtIn) {
      if (!task || typeof task.id !== 'string' || !validDays(task.days)) return null
      const base = builtIn ? DEFAULT_TASKS.find(item => item.id === task.id) : null
      if (builtIn && !base) return null
      if (!builtIn && (task.builtIn || typeof task.name !== 'string' || !task.name.trim())) return null
      const history = Array.isArray(task.history)
        ? [...new Set(task.history.filter(validDate))].sort().slice(-500) : []
      return {
        ...(base || {}),
        id: task.id.slice(0, 100),
        ...(base ? { nameKey: base.nameKey } : { name: task.name.trim().slice(0, 60), builtIn: false }),
        days: Number(task.days),
        kind: task.kind === 'replace' ? 'replace' : 'clean',
        icon: ICON_NAMES.has(task.icon) ? task.icon : base?.icon || 'home',
        lastDone: validDate(task.lastDone) ? task.lastDone : '',
        history,
      }
    }

    function readStore() {
      try {
        const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null')
        if (!saved || saved.version !== 1 || !Array.isArray(saved.tasks)) return { tasks: defaults(), error: false }
        const builtInIds = new Set(DEFAULT_TASKS.map(task => task.id))
        const builtIns = DEFAULT_TASKS.map(base => sanitizeTask(saved.tasks.find(task => task.id === base.id) || base, true))
        const custom = saved.tasks.filter(task => !builtInIds.has(task.id)).map(task => sanitizeTask(task, false)).filter(Boolean)
        return { tasks: [...builtIns, ...custom], error: false }
      } catch (error) {
        return { tasks: defaults(), error: true }
      }
    }

    function taskName(task, t) {
      return task.nameKey ? t(task.nameKey) : task.name
    }

    function taskStatus(task, today) {
      if (!task.lastDone) return { kind: 'empty', elapsed: null, remaining: null, next: '' }
      const elapsed = daysBetween(task.lastDone, today)
      const remaining = task.days - elapsed
      const next = addDays(task.lastDone, task.days)
      if (elapsed < 0) return { kind: 'empty', elapsed, remaining, next }
      if (remaining <= 0) return { kind: task.kind === 'replace' ? 'replace' : 'due', elapsed, remaining, next }
      if (remaining === 1) return { kind: 'soon', elapsed, remaining, next }
      return { kind: 'normal', elapsed, remaining, next }
    }

    function eventsForDate(tasks, value, today) {
      const events = []
      tasks.forEach(task => {
        if (task.history.includes(value)) events.push({ task, kind: 'done' })
        if (!task.lastDone) return
        if (value === today) {
          const current = taskStatus(task, today)
          if (['due', 'replace'].includes(current.kind)) {
            events.push({ task, kind: current.kind })
            return
          }
        }
        let next = addDays(task.lastDone, task.days)
        let guard = 0
        while (next < value && guard < 1000) {
          next = addDays(next, task.days)
          guard += 1
        }
        if (next === value) {
          const overdue = value <= today
          events.push({ task, kind: task.kind === 'replace' ? overdue ? 'replace' : 'replacePlan' : overdue ? 'due' : 'planned' })
        }
      })
      return events
    }

    function eventText(event, t) {
      if (event.kind === 'done') return t('done')
      if (event.kind === 'replace') return t('dueReplace')
      if (event.kind === 'replacePlan') return t('plannedReplace')
      if (event.kind === 'due') return t('dueClean')
      return event.task.kind === 'replace' ? t('plannedReplace') : t('plannedClean')
    }

    function formatDate(value, language, options = {}) {
      return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en', {
        year: 'numeric', month: 'short', day: 'numeric', ...options,
      }).format(parseDate(value))
    }

    function Icon({ name, size = 22, className = '' }) {
      const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', className, 'aria-hidden': true }
      if (name === 'calendar') return h('svg', props, h('rect', { x: 3, y: 5, width: 18, height: 16, rx: 2 }), h('path', { d: 'M7 3v4M17 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01' }))
      if (name === 'check') return h('svg', props, h('path', { d: 'm5 12 4.2 4.2L19 6.8' }))
      if (name === 'plus') return h('svg', props, h('path', { d: 'M12 5v14M5 12h14' }))
      if (name === 'tank') return h('svg', props, h('path', { d: 'M5 9h14v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9ZM8 9V5h8v4M8 14h8M9 3h6' }))
      if (name === 'pump') return h('svg', props, h('path', { d: 'M4 8h11v11H4zM15 11h3a2 2 0 0 1 2 2v3M7 5h5M8 12h3M8 15h5M18 18.5c1.2 0 2-.8 2-1.8 0-.9-2-3.2-2-3.2s-2 2.3-2 3.2c0 1 .8 1.8 2 1.8Z' }))
      if (name === 'filter') return h('svg', props, h('path', { d: 'M4 5h16l-6 7v6l-4 2v-8L4 5ZM8 8h8' }))
      if (name === 'home') return h('svg', props, h('path', { d: 'm3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7' }))
      return h('svg', props, h('path', { d: 'M12 3.2S5.5 10.1 5.5 14.8a6.5 6.5 0 0 0 13 0C18.5 10.1 12 3.2 12 3.2ZM9 15.3a3.2 3.2 0 0 0 3 3.1' }))
    }

    function HumidifierArtwork() {
      return h('svg', { className: 'hm-humidifier', viewBox: '0 0 210 200', fill: 'none', 'aria-hidden': true },
        h('path', { d: 'M90 46c-14-13 12-16-1-31M112 45c-14-13 12-16-1-31M133 49c-12-11 10-15 0-27', stroke: '#76B9A8', strokeWidth: 4, strokeLinecap: 'round', opacity: .7 }),
        h('rect', { x: 53, y: 51, width: 107, height: 126, rx: 36, fill: '#FFFFFF' }),
        h('rect', { x: 60, y: 91, width: 93, height: 79, rx: 29, fill: '#E6F4EF' }),
        h('path', { d: 'M64 115c25-14 53 15 86-2v26c0 19-14 31-32 31H92c-18 0-31-12-31-31l3-24Z', fill: '#B8DFD3' }),
        h('rect', { x: 94, y: 65, width: 25, height: 7, rx: 3.5, fill: '#D6E8E2' }),
        h('circle', { cx: 107, cy: 146, r: 7, fill: '#FFFFFF' }),
        h('path', { d: 'M107 142v5', stroke: '#54A28E', strokeWidth: 2, strokeLinecap: 'round' }),
        h('ellipse', { cx: 106, cy: 179, rx: 56, ry: 7, fill: '#76A99B', opacity: .12 }))
    }

    function SidebarIcon({ size = 20 }) {
      return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        h('path', { d: 'M10.5 3.2S5 9.2 5 13.6a5.5 5.5 0 0 0 9.5 3.8' }),
        h('rect', { x: 12, y: 9, width: 9, height: 11, rx: 2 }),
        h('path', { d: 'M15 7v3M19 7v3M12 13h9M15 16h2' }))
    }

    const PAGE_CSS = String.raw`
      .hm-page { height: 100%; min-height: 0; overflow-y: auto; overflow-x: hidden; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); font-family: inherit; }
      .hm-page * { box-sizing: border-box; }
      .hm-wrap { max-width: 1180px; margin: 0 auto; padding: calc(30px + var(--dsh-frame-top-clearance,0px)) clamp(20px,3.5vw,42px) 46px; padding-left: max(clamp(20px,3.5vw,42px),var(--dsh-frame-leading-clearance,0px)); }
      .hm-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 23px; }
      .hm-brand { display: flex; align-items: center; gap: 12px; }
      .hm-logo { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 15px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-brand-primary); border: 1px solid var(--dsw-alias-border-l1); }
      .hm-brand strong { display: block; font-size: 18px; }
      .hm-brand small { display: block; margin-top: 2px; color: var(--dsw-alias-label-secondary); font-size: 11px; }
      .hm-date { padding: 8px 13px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-1); font-size: 12px; white-space: nowrap; }
      .hm-hero { position: relative; overflow: hidden; display: grid; grid-template-columns: 1.4fr .7fr; min-height: 218px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 28px; background: linear-gradient(120deg,color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,var(--dsw-alias-bg-layer-1)),color-mix(in srgb,var(--dsw-alias-state-success-primary) 8%,var(--dsw-alias-bg-layer-1))); }
      .hm-hero-copy { position: relative; z-index: 1; padding: 31px 34px; }
      .hm-eyebrow { color: var(--dsw-alias-brand-primary); font-size: 11px; font-weight: 700; letter-spacing: .04em; }
      .hm-hero h1 { margin: 9px 0 7px; font-size: clamp(24px,3vw,32px); line-height: 1.25; letter-spacing: -.035em; }
      .hm-hero p { max-width: 560px; margin: 0; color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 1.7; }
      .hm-hero p strong { color: var(--dsw-alias-state-error-primary); }
      .hm-primary, .hm-record, .hm-create { border: 0; border-radius: 11px; background: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-base); font-weight: 700; cursor: pointer; }
      .hm-primary { display: inline-flex; align-items: center; gap: 7px; margin-top: 22px; padding: 11px 17px; font-size: 12px; }
      .hm-hero-art { position: relative; display: grid; place-items: center; min-height: 200px; }
      .hm-humidifier { width: 190px; height: 185px; }
      .hm-hero-status { position: absolute; right: 24px; bottom: 22px; padding: 8px 12px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; background: var(--dsw-alias-bg-overlay); color: var(--dsw-alias-label-secondary); font-size: 10px; }
      .hm-hero-status strong { margin-right: 3px; color: var(--dsw-alias-state-error-primary); font-size: 16px; }
      .hm-section-head { display: flex; align-items: end; justify-content: space-between; gap: 15px; margin: 26px 2px 13px; }
      .hm-section-head h2 { margin: 0; font-size: 17px; }
      .hm-section-head span { color: var(--dsw-alias-label-secondary); font-size: 11px; }
      .hm-grid { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 14px; }
      .hm-card { min-width: 0; padding: 18px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 20px; background: var(--dsw-alias-bg-layer-1); }
      .hm-card.due, .hm-card.replace { border-color: var(--dsw-alias-state-error-primary); background: color-mix(in srgb,var(--dsw-alias-state-error-primary) 5%,var(--dsw-alias-bg-layer-1)); }
      .hm-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .hm-task-icon { width: 39px; height: 39px; display: grid; place-items: center; flex: none; border-radius: 13px; background: color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,var(--dsw-alias-bg-layer-1)); color: var(--dsw-alias-brand-primary); }
      .hm-card.due .hm-task-icon, .hm-card.replace .hm-task-icon { background: color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,var(--dsw-alias-bg-layer-1)); color: var(--dsw-alias-state-error-primary); }
      .hm-badge { padding: 4px 7px; border-radius: 99px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font-size: 9px; white-space: nowrap; }
      .hm-badge.due, .hm-badge.replace { color: var(--dsw-alias-state-error-primary); }
      .hm-card h3 { overflow: hidden; margin: 14px 0 2px; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
      .hm-last { display: block; overflow: hidden; min-height: 17px; color: var(--dsw-alias-label-secondary); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
      .hm-count { min-height: 34px; margin-top: 13px; color: var(--dsw-alias-label-primary); font-size: 23px; font-weight: 760; line-height: 1.35; letter-spacing: -.03em; }
      .hm-card.due .hm-count, .hm-card.replace .hm-count { color: var(--dsw-alias-state-error-primary); font-size: 18px; }
      .hm-card.soon .hm-count { color: var(--dsw-alias-state-warn-primary); font-size: 18px; }
      .hm-progress { height: 5px; margin: 12px 0 14px; overflow: hidden; border-radius: 99px; background: var(--dsw-alias-bg-layer-2); }
      .hm-progress span { display: block; height: 100%; border-radius: inherit; background: var(--dsw-alias-brand-primary); }
      .hm-card.due .hm-progress span, .hm-card.replace .hm-progress span { background: var(--dsw-alias-state-error-primary); }
      .hm-card-actions { display: flex; gap: 7px; }
      .hm-record { flex: 1; min-width: 0; padding: 9px 8px; font-size: 10px; }
      .hm-card:not(.due):not(.replace) .hm-record { background: color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,var(--dsw-alias-bg-layer-1)); color: var(--dsw-alias-brand-primary); }
      .hm-settings { padding: 8px 9px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); cursor: pointer; font-size: 10px; }
      .hm-edit { display: grid; gap: 10px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--dsw-alias-border-l1); }
      .hm-field { display: grid; gap: 5px; color: var(--dsw-alias-label-secondary); font-size: 10px; }
      .hm-input { width: 100%; min-width: 0; padding: 9px 10px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 9px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font: inherit; font-size: 12px; }
      .hm-edit-actions { display: flex; flex-wrap: wrap; gap: 7px; }
      .hm-small-button { padding: 8px 10px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); cursor: pointer; font-size: 10px; }
      .hm-small-button.primary { border-color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-base); }
      .hm-small-button.danger { color: var(--dsw-alias-state-error-primary); }
      .hm-add { display: grid; grid-template-columns: minmax(180px,1.4fr) minmax(130px,.6fr) minmax(120px,.6fr) auto; align-items: end; gap: 12px; margin-top: 16px; padding: 18px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 18px; background: var(--dsw-alias-bg-layer-1); }
      .hm-add-title { grid-column: 1/-1; margin: 0; font-size: 14px; }
      .hm-add-actions { display: flex; gap: 7px; }
      .hm-create { padding: 10px 13px; font-size: 11px; white-space: nowrap; }
      .hm-error { margin-top: 14px; padding: 11px 14px; border: 1px solid var(--dsw-alias-state-error-primary); border-radius: 11px; color: var(--dsw-alias-state-error-primary); background: color-mix(in srgb,var(--dsw-alias-state-error-primary) 7%,var(--dsw-alias-bg-layer-1)); font-size: 11px; }
      .hm-calendar-layout { display: grid; grid-template-columns: minmax(0,1.55fr) minmax(250px,.75fr); gap: 14px; align-items: start; }
      .hm-calendar-card, .hm-selected, .hm-upcoming, .hm-guide { border: 1px solid var(--dsw-alias-border-l1); border-radius: 20px; background: var(--dsw-alias-bg-layer-1); }
      .hm-calendar-card { padding: 19px; }
      .hm-calendar-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 15px; }
      .hm-calendar-head strong { display: block; font-size: 14px; }
      .hm-calendar-head small { color: var(--dsw-alias-label-secondary); font-size: 9px; }
      .hm-calendar-controls { display: flex; gap: 5px; }
      .hm-calendar-controls button { height: 29px; padding: 0 9px; border: 0; border-radius: 8px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-brand-primary); cursor: pointer; font-size: 10px; }
      .hm-calendar-controls .hm-nav { width: 29px; padding: 0; font-size: 17px; }
      .hm-weekdays, .hm-calendar-grid { display: grid; grid-template-columns: repeat(7,minmax(0,1fr)); gap: 4px; }
      .hm-weekdays { margin-bottom: 5px; }
      .hm-weekdays span { color: var(--dsw-alias-label-secondary); text-align: center; font-size: 8px; }
      .hm-day { min-width: 0; min-height: 59px; padding: 6px 5px; border: 1px solid transparent; border-radius: 10px; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); cursor: pointer; text-align: left; }
      .hm-day.outside { opacity: .38; }
      .hm-day.today { border-color: var(--dsw-alias-brand-primary); }
      .hm-day.selected { border-color: var(--dsw-alias-brand-primary); background: color-mix(in srgb,var(--dsw-alias-brand-primary) 11%,var(--dsw-alias-bg-layer-1)); }
      .hm-day-number { display: block; margin-bottom: 4px; font-size: 9px; font-weight: 700; }
      .hm-day-events { display: grid; gap: 2px; }
      .hm-event-chip { display: block; overflow: hidden; padding: 2px 3px; border-radius: 4px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font-size: 7px; text-overflow: ellipsis; white-space: nowrap; }
      .hm-event-chip.done { background: color-mix(in srgb,var(--dsw-alias-state-success-primary) 13%,var(--dsw-alias-bg-layer-1)); color: var(--dsw-alias-state-success-primary); }
      .hm-event-chip.due { background: color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,var(--dsw-alias-bg-layer-1)); color: var(--dsw-alias-state-error-primary); }
      .hm-event-chip.replace, .hm-event-chip.replacePlan { background: color-mix(in srgb,var(--dsw-alias-state-warn-primary) 12%,var(--dsw-alias-bg-layer-1)); color: var(--dsw-alias-state-warn-primary); }
      .hm-legend { display: flex; gap: 13px; margin-top: 12px; color: var(--dsw-alias-label-secondary); font-size: 8px; }
      .hm-legend span { display: flex; align-items: center; gap: 4px; }
      .hm-legend i { width: 7px; height: 7px; border-radius: 3px; background: var(--dsw-alias-state-success-primary); }
      .hm-legend .due { background: var(--dsw-alias-state-error-primary); }
      .hm-legend .replace { background: var(--dsw-alias-state-warn-primary); }
      .hm-calendar-side { display: grid; gap: 14px; }
      .hm-selected, .hm-upcoming { padding: 18px; }
      .hm-selected-overline { color: var(--dsw-alias-label-secondary); font-size: 9px; }
      .hm-selected h3 { margin: 4px 0 12px; font-size: 18px; }
      .hm-empty { padding: 13px; border-radius: 11px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font-size: 10px; text-align: center; }
      .hm-selected-event { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-top: 1px solid var(--dsw-alias-border-l1); }
      .hm-selected-event-icon { width: 33px; height: 33px; display: grid; place-items: center; flex: none; border-radius: 10px; background: color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,var(--dsw-alias-bg-layer-1)); color: var(--dsw-alias-brand-primary); }
      .hm-selected-event strong { display: block; font-size: 10px; }
      .hm-selected-event span { color: var(--dsw-alias-label-secondary); font-size: 8px; }
      .hm-selected-action { width: 100%; margin-top: 10px; padding: 9px; border: 0; border-radius: 10px; background: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-bg-layer-1); cursor: pointer; font-size: 10px; font-weight: 700; }
      .hm-upcoming-head { display: flex; justify-content: space-between; margin-bottom: 7px; }
      .hm-upcoming-head strong { font-size: 12px; }
      .hm-upcoming-head span { color: var(--dsw-alias-label-secondary); font-size: 8px; }
      .hm-upcoming-item { display: flex; align-items: center; gap: 9px; padding: 9px 0; border-top: 1px solid var(--dsw-alias-border-l1); }
      .hm-upcoming-date { width: 35px; height: 38px; display: grid; place-items: center; flex: none; border-radius: 10px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-brand-primary); font-size: 13px; font-weight: 750; line-height: 1; }
      .hm-upcoming-date small { color: var(--dsw-alias-label-secondary); font-size: 7px; font-weight: 500; }
      .hm-upcoming-item strong { display: block; font-size: 9px; }
      .hm-upcoming-item span { color: var(--dsw-alias-label-secondary); font-size: 8px; }
      .hm-guide { margin-top: 18px; padding: 0 18px; }
      .hm-guide summary { padding: 14px 0; color: var(--dsw-alias-label-primary); cursor: pointer; font-size: 12px; font-weight: 700; }
      .hm-guide ul { margin: 0; padding: 0 0 15px 20px; color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 1.8; }
      .hm-local { margin-top: 15px; color: var(--dsw-alias-label-secondary); font-size: 10px; line-height: 1.7; }
      .hm-toast { position: fixed; z-index: 20; right: 24px; bottom: 24px; max-width: min(360px,calc(100vw - 40px)); padding: 11px 15px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 11px; background: var(--dsw-alias-bg-overlay); color: var(--dsw-alias-label-primary); box-shadow: 0 12px 30px color-mix(in srgb,var(--dsw-alias-label-primary) 14%,transparent); font-size: 11px; opacity: 0; transform: translateY(8px); pointer-events: none; transition: .18s ease; }
      .hm-toast.show { opacity: 1; transform: none; }
      .hm-page button:focus-visible, .hm-page input:focus-visible, .hm-page select:focus-visible, .hm-page summary:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
      .hm-section-actions { display: flex; align-items: center; gap: 10px; }
      .hm-add-button { display: inline-flex; align-items: center; gap: 5px; padding: 8px 11px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 9px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-brand-primary); cursor: pointer; font-size: 11px; font-weight: 700; white-space: nowrap; }
      .hm-brand small, .hm-section-head span { font-size: 12px; }
      .hm-card h3 { font-size: 14px; }
      .hm-badge, .hm-last { font-size: 11px; }
      .hm-record, .hm-settings { min-height: 36px; font-size: 11px; }
      .hm-field { font-size: 12px; }
      .hm-input { font-size: 13px; }
      .hm-calendar-head small, .hm-selected-overline { font-size: 11px; }
      .hm-weekdays span { font-size: 10px; }
      .hm-day { min-height: 66px; }
      .hm-day-number { font-size: 11px; }
      .hm-event-chip { font-size: 9px; }
      .hm-legend { font-size: 10px; }
      .hm-selected-event strong, .hm-upcoming-item strong { font-size: 12px; }
      .hm-selected-event span, .hm-upcoming-item span, .hm-upcoming-head span { font-size: 10px; }
      .hm-upcoming-date small { font-size: 9px; }
      .hm-calendar-controls button { min-height: 34px; font-size: 11px; }
      .hm-calendar-controls .hm-nav { width: 34px; }
      .hm-guide summary { font-size: 13px; }
      .hm-guide ul, .hm-local, .hm-toast { font-size: 12px; }
      .hm-toast { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .hm-toast.show { pointer-events: auto; }
      .hm-undo { flex: none; padding: 5px 9px; border: 1px solid var(--dsw-alias-brand-primary); border-radius: 7px; background: transparent; color: var(--dsw-alias-brand-primary); cursor: pointer; font-size: 11px; font-weight: 700; }
      @media (pointer: coarse) { .hm-page button { min-height: 40px; } .hm-page input, .hm-page select { font-size: 16px; } .hm-calendar-controls .hm-nav { width: 40px; } }
      @media (max-width: 1100px) { .hm-grid { grid-template-columns: repeat(2,minmax(0,1fr)); } .hm-calendar-layout { grid-template-columns: 1fr; } .hm-calendar-side { grid-template-columns: 1fr 1fr; } .hm-add { grid-template-columns: 1fr 1fr; } }
      @media (max-width: 640px) { .hm-wrap { padding: calc(20px + var(--dsh-frame-top-clearance,0px)) 14px 34px; padding-left: max(14px,var(--dsh-frame-leading-clearance,0px)); } .hm-section-actions > span { display: none; } .hm-top { align-items: flex-start; } .hm-date { display: none; } .hm-hero { grid-template-columns: 1fr; } .hm-hero-copy { padding: 24px; } .hm-hero-art { display: none; } .hm-grid, .hm-calendar-side, .hm-add { grid-template-columns: 1fr; } .hm-calendar-card { padding: 13px 10px; } .hm-day { min-height: 45px; padding: 5px 3px; } .hm-event-chip { width: 5px; height: 5px; padding: 0; border-radius: 50%; color: transparent; } .hm-day-events { display: flex; gap: 2px; } .hm-calendar-head { align-items: flex-start; } }
    `

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'home-maintenance: dictionaries')
        const sidebarText = ctx.locale.bind(NS)

        function HomeMaintenancePage(props) {
          const t = props.t || sidebarText
          const language = ctx.locale.getLocale().active
          const [initial] = useState(readStore)
          const [tasks, setTasks] = useState(initial.tasks)
          const [storageError, setStorageError] = useState(initial.error)
          const [notice, setNotice] = useState('')
          const [undo, setUndo] = useState(null)
          const [showAdd, setShowAdd] = useState(false)
          const [newName, setNewName] = useState('')
          const [newDays, setNewDays] = useState('7')
          const [newKind, setNewKind] = useState('clean')
          const [editingId, setEditingId] = useState(null)
          const [today, setToday] = useState(todayString)
          const [selectedDate, setSelectedDate] = useState(today)
          const [calendarCursor, setCalendarCursor] = useState(`${today.slice(0, 7)}-01`)
          const calendarRef = React.useRef(null)

          useEffect(() => {
            let timer
            const schedule = () => {
              clearTimeout(timer)
              const nextMidnight = new Date()
              nextMidnight.setHours(24, 0, 0, 50)
              timer = setTimeout(() => { setToday(todayString()); schedule() }, Math.max(1000, nextMidnight.getTime() - Date.now()))
            }
            const refresh = () => { setToday(todayString()); schedule() }
            const onVisibility = () => { if (!document.hidden) refresh() }
            schedule()
            document.addEventListener('visibilitychange', onVisibility)
            window.addEventListener('focus', refresh)
            return () => {
              clearTimeout(timer)
              document.removeEventListener('visibilitychange', onVisibility)
              window.removeEventListener('focus', refresh)
            }
          }, [])

          useEffect(() => {
            if (!notice) return undefined
            const timer = setTimeout(() => setNotice(''), undo ? 6000 : 3200)
            return () => clearTimeout(timer)
          }, [notice, undo])

          function saveTasks(next) {
            setTasks(next)
            try {
              window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, tasks: next }))
              setStorageError(false)
              return true
            } catch (error) {
              setStorageError(true)
              return false
            }
          }

          function completeTask(id) {
            const target = tasks.find(task => task.id === id)
            if (!target) return
            const actualToday = todayString()
            if (actualToday !== today) setToday(actualToday)
            const next = tasks.map(task => task.id === id ? {
              ...task, lastDone: actualToday, history: [...new Set([...task.history, actualToday])].sort(),
            } : task)
            setUndo({ task: target })
            const saved = saveTasks(next)
            setNotice(saved ? t('recorded', { name: taskName(target, t) }) : t('notPersisted'))
          }

          function undoLast() {
            if (!undo) return
            const next = tasks.map(task => task.id === undo.task.id ? undo.task : task)
            const saved = saveTasks(next)
            setUndo(null)
            setNotice(saved ? t('undone') : t('notPersisted'))
          }

          function updateTask(event, target) {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            const days = data.get('days')
            const lastDone = String(data.get('lastDone') || '')
            const actualToday = todayString()
            if (actualToday !== today) setToday(actualToday)
            if (!validDays(days)) { setNotice(t('invalidTask')); return }
            if (lastDone && (!validDate(lastDone) || lastDone > actualToday)) { setNotice(t('invalidDate')); return }
            const next = tasks.map(task => task.id === target.id ? {
              ...task, days: Number(days), lastDone,
              history: lastDone ? [...new Set([...task.history, lastDone])].sort() : task.history,
            } : task)
            setUndo(null)
            const saved = saveTasks(next)
            setEditingId(null)
            setNotice(saved ? t('updated') : t('notPersisted'))
          }

          function deleteTask(target) {
            const name = taskName(target, t)
            if (!window.confirm(t('confirmDelete', { name }))) return
            setUndo(null)
            const saved = saveTasks(tasks.filter(task => task.id !== target.id))
            setEditingId(null)
            setNotice(saved ? t('deleted', { name }) : t('notPersisted'))
          }

          function createTask(event) {
            event.preventDefault()
            const name = newName.trim()
            if (!name || !validDays(newDays)) { setNotice(t('invalidTask')); return }
            const task = {
              id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
              name: name.slice(0, 60), days: Number(newDays), kind: newKind,
              icon: 'home', builtIn: false, lastDone: '', history: [],
            }
            setUndo(null)
            const saved = saveTasks([...tasks, task])
            setNewName('')
            setNewDays('7')
            setNewKind('clean')
            setShowAdd(false)
            setNotice(saved ? t('added', { name: task.name }) : t('notPersisted'))
          }

          const statuses = new Map(tasks.map(task => [task.id, taskStatus(task, today)]))
          const dueTasks = tasks.filter(task => ['due', 'replace'].includes(statuses.get(task.id).kind))
          const unrecorded = tasks.filter(task => !task.lastDone)
          const firstDue = dueTasks[0]
          const heroTitle = firstDue ? t('heroDue', { count: String(dueTasks.length) }) : unrecorded.length ? t('heroEmpty') : t('heroClear')
          const heroText = firstDue
            ? t('heroDueText', { name: taskName(firstDue, t) })
            : unrecorded.length ? t('heroEmptyText') : t('heroClearText')

          const month = parseDate(calendarCursor)
          const calendarCells = useMemo(() => {
            const year = month.getFullYear()
            const monthIndex = month.getMonth()
            const first = new Date(year, monthIndex, 1, 12)
            const start = new Date(year, monthIndex, 1 - first.getDay(), 12)
            return Array.from({ length: 42 }, (_, index) => {
              const date = new Date(start)
              date.setDate(start.getDate() + index)
              const value = dateString(date)
              return { value, day: date.getDate(), outside: date.getMonth() !== monthIndex, events: eventsForDate(tasks, value, today) }
            })
          }, [calendarCursor, tasks, today])
          const calendarFocusDate = calendarCells.some(cell => cell.value === selectedDate)
            ? selectedDate : calendarCells.find(cell => !cell.outside)?.value
          const selectedEvents = eventsForDate(tasks, selectedDate, today)
          const selectedDue = selectedEvents.find(event => ['due', 'replace'].includes(event.kind))
          const upcoming = useMemo(() => {
            const result = []
            for (let offset = 1; offset <= 370 && result.length < 3; offset += 1) {
              const date = addDays(today, offset)
              eventsForDate(tasks, date, today).filter(event => event.kind !== 'done').forEach(event => {
                if (result.length < 3) result.push({ ...event, date })
              })
            }
            return result
          }, [tasks, today])

          function moveCalendarSelection(event, value) {
            const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
            let next = ''
            if (Object.hasOwn(offsets, event.key)) next = addDays(value, offsets[event.key])
            else if (event.key === 'Home') next = addDays(value, -parseDate(value).getDay())
            else if (event.key === 'End') next = addDays(value, 6 - parseDate(value).getDay())
            else return
            event.preventDefault()
            setSelectedDate(next)
            setCalendarCursor(`${next.slice(0, 7)}-01`)
            window.requestAnimationFrame(() => {
              calendarRef.current?.querySelector(`[data-home-date="${next}"]`)?.focus()
            })
          }

          return h('div', { className: 'hm-page' },
            h('style', null, PAGE_CSS),
            h('div', { className: 'hm-wrap' },
              h('header', { className: 'hm-top' },
                h('div', { className: 'hm-brand' },
                  h('div', { className: 'hm-logo' }, h(Icon, { name: 'drop' })),
                  h('div', null, h('strong', null, t('title')), h('small', null, t('subtitle')))),
                h('div', { className: 'hm-date' }, formatDate(today, language, { weekday: 'short' }))),

              h('section', { className: 'hm-hero' },
                h('div', { className: 'hm-hero-copy' },
                  h('div', { className: 'hm-eyebrow' }, t('calendarHint')),
                  h('h1', null, heroTitle),
                  h('p', null, firstDue ? h('strong', null, taskName(firstDue, t)) : null, firstDue ? ` · ${heroText}` : heroText),
                  h('button', { className: 'hm-primary', type: 'button', onClick: () => {
                    if (firstDue) completeTask(firstDue.id)
                    else if (unrecorded.length) setEditingId(unrecorded[0].id)
                    else setShowAdd(true)
                  } },
                    firstDue ? h(Icon, { name: 'check', size: 15 }) : h(Icon, { name: unrecorded.length ? 'calendar' : 'plus', size: 15 }),
                    firstDue ? t('recordFirst', { name: taskName(firstDue, t) }) : unrecorded.length ? t('fillLastDate') : t('addTask'))),
                h('div', { className: 'hm-hero-art' }, h(HumidifierArtwork), h('div', { className: 'hm-hero-status' }, h('strong', null, dueTasks.length), t('dueBadge')))),

              showAdd ? h('form', { className: 'hm-add', onSubmit: createTask },
                h('h2', { className: 'hm-add-title' }, t('customTask')),
                h('label', { className: 'hm-field' }, t('taskName'), h('input', { className: 'hm-input', value: newName, onChange: event => setNewName(event.target.value), placeholder: t('taskNamePlaceholder'), maxLength: 60, required: true, autoFocus: true })),
                h('label', { className: 'hm-field' }, t('intervalDays'), h('input', { className: 'hm-input', type: 'number', min: 1, max: 730, step: 1, value: newDays, onChange: event => setNewDays(event.target.value), required: true })),
                h('label', { className: 'hm-field' }, t('taskType'), h('select', { className: 'hm-input', value: newKind, onChange: event => setNewKind(event.target.value) }, h('option', { value: 'clean' }, t('typeClean')), h('option', { value: 'replace' }, t('typeReplace')))),
                h('div', { className: 'hm-add-actions' }, h('button', { className: 'hm-create', type: 'submit' }, t('createTask')), h('button', { className: 'hm-small-button', type: 'button', onClick: () => setShowAdd(false) }, t('cancel')))) : null,
              storageError ? h('div', { className: 'hm-error', role: 'alert' }, t('storageError')) : null,

              h('div', { className: 'hm-section-head' }, h('h2', null, t('tasks')),
                h('div', { className: 'hm-section-actions' }, h('span', null, t('autoCalculated')),
                  h('button', { className: 'hm-add-button', type: 'button', 'aria-expanded': showAdd, onClick: () => setShowAdd(!showAdd) }, h(Icon, { name: showAdd ? 'check' : 'plus', size: 14 }), t(showAdd ? 'cancel' : 'addTask')))),
              h('div', { className: 'hm-grid' }, tasks.map(task => {
                const status = statuses.get(task.id)
                const overdue = ['due', 'replace'].includes(status.kind)
                const countText = status.kind === 'empty'
                  ? task.lastDone ? t('futureDate') : t('unrecorded')
                  : status.kind === 'due' ? status.remaining === 0 ? t('cleanToday') : t('overdueClean')
                    : status.kind === 'replace' ? status.remaining === 0 ? t('replaceToday') : t('overdueReplace')
                      : status.kind === 'soon' ? t('tomorrow')
                        : t(task.kind === 'replace' ? 'daysLaterReplace' : 'daysLater', { days: String(status.remaining) })
                const progress = status.elapsed === null || status.elapsed < 0 ? 0 : Math.min(100, Math.max(4, status.elapsed / task.days * 100))
                return h('article', { className: `hm-card ${status.kind}`, key: task.id },
                  h('div', { className: 'hm-card-top' }, h('div', { className: 'hm-task-icon' }, h(Icon, { name: task.icon })), h('span', { className: `hm-badge ${status.kind}` }, overdue ? t(status.kind === 'replace' ? 'dueReplace' : 'dueClean') : t('everyDays', { days: String(task.days) }))),
                  h('h3', { title: taskName(task, t) }, taskName(task, t)),
                  h('span', { className: 'hm-last' }, task.lastDone ? t(task.kind === 'replace' ? 'lastReplace' : 'lastClean', { date: formatDate(task.lastDone, language) }) : t('neverRecorded')),
                  h('div', { className: 'hm-count' }, countText),
                  h('div', { className: 'hm-progress', 'aria-hidden': true }, h('span', { style: { width: `${progress}%` } })),
                  h('div', { className: 'hm-card-actions' },
                    h('button', { className: 'hm-record', type: 'button', onClick: () => completeTask(task.id) }, t(task.kind === 'replace' ? 'recordReplace' : 'recordClean')),
                    h('button', { className: 'hm-settings', type: 'button', 'aria-expanded': editingId === task.id, onClick: () => setEditingId(editingId === task.id ? null : task.id) }, t(editingId === task.id ? 'closeSettings' : 'settings'))),
                  editingId === task.id ? h('form', { className: 'hm-edit', onSubmit: event => updateTask(event, task) },
                    h('label', { className: 'hm-field' }, t('intervalDays'), h('input', { className: 'hm-input', name: 'days', type: 'number', min: 1, max: 730, step: 1, defaultValue: task.days, required: true })),
                    h('label', { className: 'hm-field' }, t('lastDoneDate'), h('input', { className: 'hm-input', name: 'lastDone', type: 'date', max: today, defaultValue: task.lastDone, autoFocus: true })),
                    h('div', { className: 'hm-edit-actions' },
                      h('button', { className: 'hm-small-button primary', type: 'submit' }, t('saveSettings')),
                      h('button', { className: 'hm-small-button', type: 'button', onClick: () => setEditingId(null) }, t('cancel')),
                      !task.builtIn ? h('button', { className: 'hm-small-button danger', type: 'button', onClick: () => deleteTask(task) }, t('deleteTask')) : null)) : null)
              })),

              h('div', { className: 'hm-section-head' }, h('h2', null, t('calendar')), h('span', null, t('calendarHint'))),
              h('div', { className: 'hm-calendar-layout' },
                h('section', { className: 'hm-calendar-card' },
                  h('div', { className: 'hm-calendar-head' },
                    h('div', null, h('strong', { 'aria-live': 'polite' }, formatDate(calendarCursor, language, { day: undefined })), h('small', null, t('autoCalculated'))),
                    h('div', { className: 'hm-calendar-controls' },
                      h('button', { className: 'hm-nav', type: 'button', 'aria-label': t('previousMonth'), onClick: () => setCalendarCursor(dateString(new Date(month.getFullYear(), month.getMonth() - 1, 1, 12))) }, '‹'),
                      h('button', { type: 'button', onClick: () => { setCalendarCursor(`${today.slice(0, 7)}-01`); setSelectedDate(today) } }, t('backToday')),
                      h('button', { className: 'hm-nav', type: 'button', 'aria-label': t('nextMonth'), onClick: () => setCalendarCursor(dateString(new Date(month.getFullYear(), month.getMonth() + 1, 1, 12))) }, '›'))),
                  h('div', { className: 'hm-weekdays' }, Array.from({ length: 7 }, (_, index) => h('span', { key: index }, t(`weekday${index}`)))),
                  h('div', { className: 'hm-calendar-grid', ref: calendarRef }, calendarCells.map(cell => h('button', {
                    type: 'button', key: cell.value,
                    className: `hm-day${cell.outside ? ' outside' : ''}${cell.value === today ? ' today' : ''}${cell.value === selectedDate ? ' selected' : ''}`,
                    'aria-label': `${formatDate(cell.value, language)} ${cell.events.map(event => taskName(event.task, t)).join(', ')}`,
                    'aria-current': cell.value === today ? 'date' : undefined,
                    'aria-pressed': cell.value === selectedDate,
                    'data-home-date': cell.value,
                    tabIndex: cell.value === calendarFocusDate ? 0 : -1,
                    onKeyDown: event => moveCalendarSelection(event, cell.value),
                    onClick: () => { setSelectedDate(cell.value); if (cell.outside) setCalendarCursor(`${cell.value.slice(0, 7)}-01`) },
                  }, h('span', { className: 'hm-day-number' }, cell.day), h('span', { className: 'hm-day-events' },
                    cell.events.slice(0, 2).map((event, index) => h('span', { className: `hm-event-chip ${event.kind}`, key: `${event.task.id}-${index}`, title: taskName(event.task, t) }, `${taskName(event.task, t)}${event.kind === 'done' ? ' ✓' : ''}`)),
                    cell.events.length > 2 ? h('span', { className: 'hm-event-chip' }, `+${cell.events.length - 2}`) : null)))),
                  h('div', { className: 'hm-legend' }, h('span', null, h('i'), t('legendDone')), h('span', null, h('i', { className: 'due' }), t('legendDue')), h('span', null, h('i', { className: 'replace' }), t('legendReplace')))),

                h('aside', { className: 'hm-calendar-side' },
                  h('section', { className: 'hm-selected' },
                    h('div', { className: 'hm-selected-overline' }, `${formatDate(selectedDate, language, { weekday: 'long' })} · ${t('selectedDate')}`),
                    h('h3', null, formatDate(selectedDate, language, { year: undefined })),
                    selectedEvents.length ? selectedEvents.map((event, index) => h('div', { className: `hm-selected-event ${event.kind}`, key: `${event.task.id}-${event.kind}-${index}` },
                      h('div', { className: 'hm-selected-event-icon' }, h(Icon, { name: event.task.icon, size: 17 })),
                      h('div', null, h('strong', null, taskName(event.task, t)), h('span', null, `${eventText(event, t)} · ${t('everyDays', { days: String(event.task.days) })}`)))) : h('div', { className: 'hm-empty' }, t('noEvents')),
                    selectedDue ? h('button', { className: 'hm-selected-action', type: 'button', onClick: () => completeTask(selectedDue.task.id) }, t(selectedDue.task.kind === 'replace' ? 'recordReplace' : 'recordClean')) : null),
                  h('section', { className: 'hm-upcoming' },
                    h('div', { className: 'hm-upcoming-head' }, h('strong', null, t('upcoming')), h('span', null, t('upcomingHint'))),
                    upcoming.length ? upcoming.map((event, index) => {
                      const date = parseDate(event.date)
                      return h('div', { className: 'hm-upcoming-item', key: `${event.task.id}-${event.date}-${index}` },
                        h('div', { className: 'hm-upcoming-date' }, date.getDate(), h('small', null, formatDate(event.date, language, { year: undefined, day: undefined }))),
                        h('div', null, h('strong', null, taskName(event.task, t)), h('span', null, `${eventText(event, t)} · ${t('everyDays', { days: String(event.task.days) })}`)))
                    }) : h('div', { className: 'hm-empty' }, t('noUpcoming'))))),

              h('details', { className: 'hm-guide' }, h('summary', null, t('guideTitle')), h('ul', null, h('li', null, t('guideFilter')), h('li', null, t('guideTank')), h('li', null, t('guidePump')))),
              h('p', { className: 'hm-local' }, t('localOnly'))),
            h('div', { className: `hm-toast${notice ? ' show' : ''}`, role: 'status', 'aria-live': 'polite' }, h('span', null, notice), undo && notice ? h('button', { className: 'hm-undo', type: 'button', onClick: undoLast }, t('undo')) : null))
        }

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main', key: PANEL_ID, locale: NS,
        }, HomeMaintenancePage))
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: PANEL_ID, order: 20,
          label: () => sidebarText('panel'), locale: NS,
        }, SidebarIcon))
      },
    }
  },
})
