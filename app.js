const taskForm = document.querySelector('#task-form');
const taskInput = document.querySelector('#task-input');
const taskList = document.querySelector('#task-list');
const errorMessage = document.querySelector('#error-message');
const filterButtons = [...document.querySelectorAll('.filter-button')];
const clearCompletedButton = document.querySelector('#clear-completed');
let tasks = [];
let currentFilter = 'all';

const dateLabel = new Intl.DateTimeFormat('en', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
}).format(new Date());
document.querySelector('#today-date').textContent = dateLabel;

function showError(message = '') {
  errorMessage.textContent = message;
  errorMessage.hidden = !message;
}

async function request(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || 'Something went wrong. Please try again.');
  }
  return response.status === 204 ? null : response.json();
}

function render() {
  const completedCount = tasks.filter((task) => task.completed).length;
  const activeCount = tasks.length - completedCount;
  document.querySelector('#all-count').textContent = tasks.length;
  document.querySelector('#active-count').textContent = activeCount;
  document.querySelector('#progress-number').textContent = completedCount;
  clearCompletedButton.hidden = completedCount === 0;

  for (const button of filterButtons) {
    const isActive = button.dataset.filter === currentFilter;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  }

  const visibleTasks = tasks.filter((task) => {
    if (currentFilter === 'active') return !task.completed;
    if (currentFilter === 'completed') return task.completed;
    return true;
  });
  taskList.replaceChildren();

  if (visibleTasks.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = currentFilter === 'completed' ? '○' : '✳';
    const message = document.createElement('span');
    message.textContent = currentFilter === 'all' ? 'Nothing on your list yet. Add a task above.'
      : currentFilter === 'active' ? 'You’re all caught up.' : 'Completed tasks will show up here.';
    empty.append(icon, message);
    taskList.append(empty);
    return;
  }

  for (const task of visibleTasks) {
    const item = document.createElement('li');
    item.className = `task-item${task.completed ? ' is-complete' : ''}`;

    const checkbox = document.createElement('input');
    checkbox.className = 'task-check';
    checkbox.type = 'checkbox';
    checkbox.checked = task.completed;
    checkbox.setAttribute('aria-label', `${task.completed ? 'Mark active' : 'Complete'}: ${task.title}`);
    checkbox.addEventListener('change', () => updateTask(task.id, checkbox.checked));

    const title = document.createElement('span');
    title.className = 'task-title';
    title.textContent = task.title;

    const time = document.createElement('time');
    time.className = 'task-time';
    time.dateTime = task.createdAt;
    time.textContent = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' })
      .format(new Date(task.createdAt));

    const removeButton = document.createElement('button');
    removeButton.className = 'delete-button';
    removeButton.type = 'button';
    removeButton.setAttribute('aria-label', `Delete ${task.title}`);
    removeButton.title = 'Delete task';
    removeButton.textContent = '×';
    removeButton.addEventListener('click', () => deleteTask(task.id));

    item.append(checkbox, title, time, removeButton);
    taskList.append(item);
  }
}

async function loadTasks() {
  try {
    tasks = await request('/api/tasks');
    render();
  } catch (error) {
    showError(error.message);
  }
}

async function updateTask(id, completed) {
  showError();
  try {
    const updated = await request(`/api/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ completed }),
    });
    tasks = tasks.map((task) => task.id === id ? updated : task);
    render();
  } catch (error) {
    showError(error.message);
    await loadTasks();
  }
}

async function deleteTask(id) {
  showError();
  try {
    await request(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
    tasks = tasks.filter((task) => task.id !== id);
    render();
  } catch (error) {
    showError(error.message);
  }
}

taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = taskInput.value.trim();
  if (!title) return;

  showError();
  try {
    const task = await request('/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    tasks.unshift(task);
    taskInput.value = '';
    currentFilter = 'all';
    render();
    taskInput.focus();
  } catch (error) {
    showError(error.message);
  }
});

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    currentFilter = button.dataset.filter;
    render();
  });
});

clearCompletedButton.addEventListener('click', async () => {
  showError();
  try {
    await request('/api/tasks/completed', { method: 'DELETE' });
    tasks = tasks.filter((task) => !task.completed);
    render();
  } catch (error) {
    showError(error.message);
    await loadTasks();
  }
});

loadTasks();