import { store } from '../stores/appStore';
import { Habit, HabitMode, ScheduleType } from '../types';
import { createModal, createToast } from './TerminalUI';

/** Open the New Habit / Edit Habit modal. Pass a habit to edit, omit to create. */
export function openHabitForm(habit?: Habit): void {
  const isEdit = !!habit;
  const schedType: ScheduleType = habit?.schedule.type || 'daily';

  const content = document.createElement('div');
  content.className = 'habit-form';
  const modeOpts: HabitMode[] = ['checkbox', 'counter', 'number', 'timer', 'health'];
  content.innerHTML = `
    <div class="form-group"><label>Name</label><input type="text" id="h-name" required placeholder="e.g., Morning run" value="${habit?.name ?? ''}"></div>
    <div class="form-row">
      <div class="form-group"><label>Icon</label><input type="text" id="h-icon" value="${habit?.icon ?? '🏃'}" maxlength="2"></div>
      <div class="form-group"><label>Color</label><input type="color" id="h-color" value="${habit?.color ?? '#7aa2f7'}"></div>
    </div>
    <div class="form-group"><label>Mode</label><select id="h-mode">${modeOpts.map(m => `<option value="${m}" ${habit?.mode === m ? 'selected' : ''}>${m[0].toUpperCase()}${m.slice(1)}</option>`).join('')}</select></div>
    <div class="form-group" id="target-group" style="display:${habit && habit.mode !== 'checkbox' ? 'block' : 'none'}"><label>Target</label><input type="number" id="h-target" value="${habit?.target ?? 1}" min="1"></div>
    <div class="form-group" id="unit-group" style="display:${habit && habit.mode !== 'checkbox' ? 'block' : 'none'}"><label>Unit (optional)</label><input type="text" id="h-unit" placeholder="km, pages, min" value="${habit?.unit ?? ''}"></div>
    <div class="form-group"><label>Schedule</label><select id="h-sched"><option value="daily" ${schedType === 'daily' ? 'selected' : ''}>Daily</option><option value="weekdays" ${schedType === 'weekdays' ? 'selected' : ''}>Weekdays</option><option value="custom" ${schedType === 'custom' ? 'selected' : ''}>Custom</option></select></div>
    <div class="form-group" id="custom-days" style="display:${schedType === 'custom' ? 'block' : 'none'}"><label>Days</label><div class="day-checkboxes">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => `<label><input type="checkbox" value="${i}" ${habit?.schedule.days?.includes(i) ? 'checked' : ''}> ${d}</label>`).join('')}</div></div>
    <div class="form-actions"><button class="btn btn-ghost" id="h-cancel">Cancel</button><button class="btn btn-primary" id="h-save">${isEdit ? 'Save' : 'Create'}</button></div>
  `;

  createModal(isEdit ? 'Edit Habit' : 'New Habit', content, () => {});

  content.querySelector('#h-mode')?.addEventListener('change', e => {
    const show = (e.target as HTMLSelectElement).value !== 'checkbox';
    (content.querySelector('#target-group') as HTMLElement).style.display = show ? 'block' : 'none';
    (content.querySelector('#unit-group') as HTMLElement).style.display = show ? 'block' : 'none';
  });
  content.querySelector('#h-sched')?.addEventListener('change', e => {
    (content.querySelector('#custom-days') as HTMLElement).style.display = (e.target as HTMLSelectElement).value === 'custom' ? 'block' : 'none';
  });
  content.querySelector('#h-cancel')?.addEventListener('click', () => document.querySelector('.modal-overlay')?.remove());
  content.querySelector('#h-save')?.addEventListener('click', async () => {
    const name = (content.querySelector('#h-name') as HTMLInputElement).value.trim();
    if (!name) return;
    const mode = (content.querySelector('#h-mode') as HTMLSelectElement).value as HabitMode;
    const st = (content.querySelector('#h-sched') as HTMLSelectElement).value as ScheduleType;
    const schedule: { type: ScheduleType; days?: number[] } = { type: st };
    if (st === 'custom') schedule.days = Array.from(content.querySelectorAll('#custom-days input:checked')).map(cb => parseInt((cb as HTMLInputElement).value));
    const icon = (content.querySelector('#h-icon') as HTMLInputElement).value || '✦';
    const color = (content.querySelector('#h-color') as HTMLInputElement).value;
    const target = parseInt((content.querySelector('#h-target') as HTMLInputElement).value) || 1;
    const unit = (content.querySelector('#h-unit') as HTMLInputElement).value || undefined;

    if (isEdit) {
      await store.updateHabit({ ...habit!, name, icon, color, mode, target, unit, schedule });
      createToast('Habit updated', 'success');
    } else {
      await store.createHabit({ name, icon, color, mode, target, unit, schedule, reminders: [] });
      createToast('Habit created', 'success');
    }
    document.querySelector('.modal-overlay')?.remove();
  });
}
