const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);

const addBtn = $('.add-btn');
const cancelBtn = $('.cancel-btn');
const closeBtn = $('.modal-close-btn');
const taskModal = $('#addTaskModal');
const todoForm = $('.todo-app-form');
const todoList = $('#todo-list');
const searchInput = $('.search-input');
const tabList = $('.tab-list');
const tabActive = $('.tab-active');
const tabCompleted = $('.tab-completed');
const tabAll = $('.tab-all');
const modalOverlay = $('.modal-overlay');
const modalContent = taskModal.querySelector('.modal');

let editId = null;
const BASE_API = 'http://localhost:3000/tasks';

// Hold the list of tasks to avoid calling the API repeatedly.
let tasks = [];

// === INITIALIZE APP ===
initialiseTodoApp();

[addBtn, closeBtn, cancelBtn, modalOverlay].forEach((btn) => {
    btn.addEventListener('click', handleModalActions);
});

modalContent.addEventListener('click', (e) => e.stopPropagation());

async function initialiseTodoApp() {
    // Load data for the first time and save it to the state variable
    tasks = await getData();
    renderTasks(tasks);

    todoForm.addEventListener('submit', addNewTask);
    todoList.addEventListener('click', handleTaskActions);
    tabList.addEventListener('click', handleTabActions);
    searchInput.addEventListener('focus', handleSearchFocus);
    searchInput.addEventListener('input', handleSearchInput);
}

// === DATA FETCHING ===
async function getData() {
    try {
        const res = await fetch(`${BASE_API}?_sort=-createdAt`);
        const data = await res.json();
        return data;
    } catch (error) {
        console.log(error);
        return [];
    }
}

async function taskAPIRequest({ taskId = null, method, data = null }) {
    try {
        const url = taskId ? `${BASE_API}/${taskId}` : BASE_API;
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            ...(data && { body: JSON.stringify(data) }),
        };

        const response = await fetch(url, options);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        // With the DELETE method, there is no content returned
        if (method === 'DELETE') {
            return response;
        }

        // Return JSON data for GET/POST/PATCH/PUT
        return response.json();
    } catch (error) {
        console.error('API request failed:', error);
    }
}

// === TASK CRUD OPERATIONS ===
async function deleteTask(taskToDelete) {
    await taskAPIRequest({ taskId: taskToDelete.id, method: 'DELETE' });

    // Update the local state instead of calling getData() again
    tasks = tasks.filter((task) => task.id !== taskToDelete.id);

    renderTasks(tasks);
    showToast('Task deleted successfully!', 'deleted');
}

async function completeTask(taskToComplete) {
    const updatedTaskData = { isCompleted: !taskToComplete.isCompleted };
    const updatedTask = await taskAPIRequest({
        taskId: taskToComplete.id,
        method: 'PATCH',
        data: updatedTaskData,
    });

    // Update the local state
    const taskIndex = tasks.findIndex((task) => task.id === updatedTask.id);
    if (taskIndex !== -1) {
        tasks[taskIndex] = updatedTask;
    }

    renderTasks(tasks);
    showToast('Task updated successfully!', 'updated');
}

// === FORM HANDLING ===
async function addNewTask(e) {
    e.preventDefault();

    try {
        const formData = Object.fromEntries(new FormData(todoForm));
        const isEditMode = editId !== null;

        if (isDuplicateTask(formData, editId)) {
            showAlertModal(
                isEditMode
                    ? "Title can't be the same."
                    : 'Title already exists in the list. Please enter a new title.'
            );
            return;
        }

        if (isEditMode) {
            await handleEditTaskAndRenderTask(formData);
            showToast('Task updated successfully!', 'updated');
        } else {
            await handleCreateAndRenderTask(formData);
            showToast('Task added successfully!', 'success');
        }

        toggleModal();
    } catch (error) {
        console.error('Error in addNewTask:', error);
        showAlertModal(
            'An error occurred while processing the task. Please try again.'
        );
    }
}

async function handleEditTaskAndRenderTask(formData) {
    const existingTask = tasks.find((task) => task.id === editId);

    const updatedTaskData = {
        ...existingTask,
        ...formData,
        title: formData.title.trim(),
    };

    const updatedTask = await taskAPIRequest({
        taskId: editId,
        method: 'PATCH',
        data: updatedTaskData,
    });

    // Update the local state
    const taskIndex = tasks.findIndex((task) => task.id === updatedTask.id);
    if (taskIndex !== -1) {
        tasks[taskIndex] = updatedTask;
    }

    renderTasks(tasks);
}

async function handleCreateAndRenderTask(formData) {
    const newTaskData = {
        ...formData,
        title: formData.title.trim(),
        isCompleted: false,
        createdAt: new Date().toISOString(),
    };

    const newTask = await taskAPIRequest({ method: 'POST', data: newTaskData });

    // Update the local state
    tasks.unshift(newTask);

    renderTasks(tasks);
}

function isDuplicateTask(newTask, taskId = '') {
    return tasks.some(
        (todo) =>
            todo.title.trim().toLowerCase() ===
                newTask.title.trim().toLowerCase() && todo.id !== taskId
    );
}

function fillEditForm(task) {
    for (const key in task) {
        const value = task[key];
        const inputSection = todoForm.querySelector(`[name=${key}]`);
        if (inputSection) {
            inputSection.value = value;
        }
    }
}

function editTask(task) {
    taskModal.classList.toggle('show');

    const modalTitle = taskModal.querySelector('.modal-title');
    if (modalTitle) {
        modalTitle.dataset.originalText = modalTitle.textContent;
        modalTitle.textContent = 'Edit Task';
    }

    const submitBtn = taskModal.querySelector('.submit-btn');
    if (submitBtn) {
        submitBtn.dataset.originalText = submitBtn.textContent;
        submitBtn.textContent = 'Save Task';
    }

    fillEditForm(task); // get new data & fill in the form
}

// === UI RENDERING ===
function renderTasks(tasksToRender) {
    if (!tasksToRender || !tasksToRender.length) {
        todoList.innerHTML = `
            <div class="empty-tasks">
                <img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f4dd.png" alt="Empty" class="empty-illustration">
                <p class="empty-text">No results found</p>
              
            </div>
        `;
        return;
    }

    todoList.innerHTML = tasksToRender.map(generateTaskHTML).join('');
}

function generateTaskHTML(todo) {
    return `  <div class="task-card  ${escapeHTML(todo.cardColor)} ${
        todo.isCompleted ? 'completed' : ''
    }" data-id='${todo.id}'>
                    <div class="task-header">
                        <div class="task-meta">
                          <span class="task-category">
                        ${escapeHTML(capitaliseFirstLetter(todo.category))}
                        </span> -
                        <span class="task-priority">    
                        ${escapeHTML(
                            capitaliseFirstLetter(todo.priority)
                        )} Priority
                        </span>

                        </div>
                        <button type="button" class="task-menu">
                            <i class="fa-solid fa-ellipsis fa-icon"></i>
                            <div class="dropdown-menu">
                                <div class="dropdown-item edit-btn">
                                    <i
                                        class="fa-solid fa-pen-to-square fa-icon"
                                    ></i>
                                    Edit
                                </div>
                                <div class="dropdown-item complete-btn">
                                    <i class="fa-solid fa-check fa-icon"></i>
                                    ${
                                        todo.isCompleted
                                            ? 'Mark as Active'
                                            : 'Mark as Complete'
                                    }
                                </div>
                                <div class="dropdown-item delete-btn">
                                    <i class="fa-solid fa-trash fa-icon"></i>
                                    Delete
                                </div>
                            </div>
                        </button>
                    </div>

                    <h3 class="task-title" >${escapeHTML(todo.title)}</h3>

                    <p class="task-description" >
                       ${escapeHTML(todo.description)}
                    </p>

                    <div class="task-time-row">
                        <div class="task-time">${escapeHTML(
                            convertTime(todo.startTime)
                        )} - ${escapeHTML(convertTime(todo.endTime))} </div>
                        <div class="task-due-date">Due: ${escapeHTML(
                            formatDate(todo.dueDate)
                        )}</div>
                    </div>
                </div>`;
}

function setActiveTab(tab) {
    $$('.tab-button').forEach((btn) => btn.classList.remove('active'));
    tab.classList.add('active');
}

// === EVENT HANDLERS ===
function handleSearchFocus() {
    setActiveTab(tabAll);
    renderTasks(tasks); // Dùng state cục bộ
}

function handleSearchInput(e) {
    const input = e.target.value.trim().toLowerCase();

    const result = input
        ? tasks.filter(
              (todo) =>
                  todo.title.trim().toLowerCase().includes(input) ||
                  todo.description.trim().toLowerCase().includes(input)
          )
        : tasks;

    renderTasks(result);
}

function handleTabActions(e) {
    const isActiveTab = e.target.closest('.tab-active');
    const isCompletedTab = e.target.closest('.tab-completed');
    const isAllTab = e.target.closest('.tab-all');
    let filteredTasks = tasks;

    if (isActiveTab) {
        setActiveTab(tabActive);
        filteredTasks = tasks.filter((task) => !task.isCompleted);
    } else if (isCompletedTab) {
        setActiveTab(tabCompleted);
        filteredTasks = tasks.filter((task) => task.isCompleted);
    } else if (isAllTab) {
        setActiveTab(tabAll);
    }

    renderTasks(filteredTasks);
}

function handleTaskActions(e) {
    const editAction = e.target.closest('.edit-btn');
    const completeAction = e.target.closest('.complete-btn');
    const deleteAction = e.target.closest('.delete-btn');

    const taskElement = e.target.closest('.task-card');
    if (!taskElement) return;

    const taskId = taskElement.dataset.id;
    const task = tasks.find((t) => t.id === taskId); // == vì data-id có thể là string

    if (!task) return;

    editId = taskId;

    if (editAction) {
        editTask(task);
        return;
    }

    if (completeAction) {
        completeTask(task);
        return;
    }

    if (deleteAction) {
        showAlertModal(
            `Are you sure you want to delete "${task.title}"?`,
            () => {
                deleteTask(task);
            }
        );
    }
}

function handleModalActions(e) {
    if (e.currentTarget === addBtn) {
        resetModal();
        title.focus();
        return;
    }

    if (
        e.currentTarget === closeBtn ||
        e.currentTarget === cancelBtn ||
        (e.currentTarget === modalOverlay && e.target === modalOverlay)
    ) {
        const isEditMode = editId !== null;

        const message = isEditMode
            ? 'Are you sure you want to close the form?'
            : 'Closing the form will reset all entered data. Are you sure?';

        showAlertModal(message, () => {
            resetModal();
            resetModalHeaderAndButton();
        });
    }
}

// === MODAL / UI UTILITIES ===
function resetModal() {
    // Always reset form & editId = null whenever add new task or close modal
    todoForm.reset();
    toggleModal();
    editId = null;
    document.activeElement.blur();
}

function resetModalHeaderAndButton() {
    const modalTitle = taskModal.querySelector('.modal-title');
    if (modalTitle) {
        modalTitle.textContent =
            modalTitle.dataset.originalText || modalTitle.textContent;
        delete modalTitle.dataset.originalText;
    }

    const submitBtn = taskModal.querySelector('.submit-btn');
    if (submitBtn) {
        submitBtn.textContent =
            submitBtn.dataset.originalText || submitBtn.textContent;
        delete submitBtn.dataset.originalText;
    }

    const modal = taskModal.querySelector('.modal');
    if (modal) {
        setTimeout(() => {
            modal.scrollTop = 0;
        }, 200);
    }
}

function toggleModal() {
    taskModal.classList.toggle('show');
}

function escapeHTML(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
}

function showToast(message, type = 'success') {
    const toastContainer = $('#toast-container');
    const icons = {
        success: 'fa-solid fa-circle-check',
        updated: 'fa-solid fa-bullhorn',
        deleted: 'fa-solid fa-circle-exclamation',
    };
    const icon = icons[type];

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.animation = `slideIn 0.3s ease-out, fadeOut 0.6s ease-in 6s forwards`;

    toast.innerHTML = ` <span class="toast-icon">
    <i class="${icon}"></i>
    </span>
    <div class="toast-message">${message}</div>
    <button class="toast-close">&times;</button>`;

    // Auto dismiss
    const autoDismissId = setTimeout(() => {
        toast.remove();
    }, 5000);

    // Close on click
    toast.querySelector('.toast-close').onclick = () => {
        toast.remove();
        clearTimeout(autoDismissId);
    };

    toastContainer.appendChild(toast);
}

function convertTime(timeStr) {
    if (!timeStr) return '';
    const timeFrame = timeStr.split(':');
    const hour = parseInt(timeFrame[0], 10);
    const minutes = timeFrame[1];
    return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function capitaliseFirstLetter(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function formatDate(date) {
    if (!date) return '';
    return date.split('-').reverse().join('-');
}

function showAlertModal(message, confirmHandler = null) {
    const modal = $('#alertModal');
    const msg = modal.querySelector('.alert-message');
    const cancelBtn = $('#alertCancel');
    const confirmBtn = $('#alertConfirm');

    // Show message of the modal
    msg.textContent = message;
    modal.classList.add('show');

    // Logic HERE decide to display Cancel or not
    if (confirmHandler) {
        cancelBtn.style.display = 'inline-block'; // ✅ display Cancel
        confirmBtn.textContent = 'Yes'; // Change text of confirmBtn to YES
    } else {
        cancelBtn.style.display = 'none'; // ❌ hide Cancel if don't need confirm
        confirmBtn.textContent = 'OK'; // Change text of confirmBtn to OK
    }

    // Close modal when click Cancel
    cancelBtn.onclick = () => {
        modal.classList.remove('show');
    };

    // When click OK / Yes -> confirmHandler will execute logic inside
    confirmBtn.onclick = () => {
        modal.classList.remove('show');
        if (confirmHandler && typeof confirmHandler === 'function') {
            confirmHandler();
        }
    };
}
