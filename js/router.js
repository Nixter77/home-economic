/**
 * Роутер на основе Location Hash (#)
 */

class Router {
  constructor() {
    this.routes = {};
    this.currentRoute = null;
    this.defaultRoute = 'dashboard';

    window.addEventListener('hashchange', () => this.handleHashChange());
  }

  addRoute(path, handler) {
    this.routes[path] = handler;
  }

  setDefaultRoute(path) {
    this.defaultRoute = path;
  }

  navigate(path) {
    window.location.hash = `#${path}`;
  }

  handleHashChange() {
    const rawHash = window.location.hash.slice(1);
    const route = rawHash.trim() || this.defaultRoute;

    if (this.routes[route]) {
      this.currentRoute = route;
      this.updateActiveNav(route);
      this.routes[route]();
    } else if (this.routes[this.defaultRoute]) {
      this.navigate(this.defaultRoute);
    }
  }

  updateActiveNav(route) {
    document.querySelectorAll('.nav-item').forEach(el => {
      const target = el.getAttribute('href')?.replace('#', '');
      if (target === route) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }

  start() {
    this.handleHashChange();
  }
}

export const router = new Router();
