/* tslint:disable */
let namespaces = {};

function Namespace(name) {
  this.active = {};
}

Namespace.prototype.set = function (key, value) {
  this.active[key] = value;
  return value;
};

Namespace.prototype.get = function (key) {
  return this.active[key];
};

Namespace.prototype.createContext = function () {
  return Object.create(this.active);
};

Namespace.prototype.run = function (fn) {
  fn(this.active);
  return this.active;
};

Namespace.prototype.runAndReturn = function (fn) {
  let value;
  this.run(function (context) {
    value = fn(context);
  });
  return value;
};

Namespace.prototype.bind = function (fn, context) {
  return function () {
    return fn.apply(this, arguments);
  };
};

Namespace.prototype.enter = function (context) {
  this.active = context;
};

Namespace.prototype.exit = function (context) {};

Namespace.prototype.bindEmitter = function (emitter) {};
Namespace.prototype.fromException = function (exception) {};

function get(name) {
  return namespaces[name];
}

function create(name) {
  const namespace = new Namespace(name);
  namespaces[name] = namespace;
  return namespace;
}

function destroy(name) {
  namespaces[name] = null;
}

function reset() {
  namespaces = Object.create(null);
}

module.exports = {
  getNamespace     : get,
  createNamespace  : create,
  destroyNamespace : destroy,
  reset
};
