import { eventBus } from '../core/event-bus.js';

const routes = {};
let currentView = null;
let currentRoute = null;

export function registerRoute(path, viewModule) {
    routes[path] = viewModule;
}

export function navigate(path) {
    window.location.hash = path;
}

export function getCurrentRoute() {
    return currentRoute;
}

export function initRouter() {
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
}

function handleRoute() {
    const hash = window.location.hash.slice(1) || '/new-game';
    const [path, ...paramParts] = hash.split('/').filter(Boolean);
    const routePath = '/' + path;
    const params = paramParts.join('/');

    const view = routes[routePath];
    if (!view) {
        console.warn('No route for:', routePath);
        navigate('/new-game');
        return;
    }

    const container = document.getElementById('main-content');
    if (!container) return;

    // Destroy current view
    if (currentView && currentView.destroy) {
        currentView.destroy();
    }

    // Clear container
    container.innerHTML = '';
    container.className = 'view-enter';

    // Render new view
    currentView = view;
    currentRoute = routePath;
    view.render(container, params);

    // Update sidebar active state
    document.querySelectorAll('#sidebar .nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.route === routePath);
    });

    eventBus.emit('routeChanged', { path: routePath, params });
}

export function refreshCurrentView() {
    handleRoute();
}
