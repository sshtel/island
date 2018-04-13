const USE_CLS = false;
let cls;

if (USE_CLS) {
  cls = require('continuation-local-storage');
  const ns = cls.getNamespace('app') || cls.createNamespace('app');
  require('cls-mongoose')(ns);
  require('cls-bluebird')(ns);
} else {
  cls = require('./mock-cls');
  cls.getNamespace('app') || cls.createNamespace('app');
}
cls['init'] = function() {
  //make sure it is always imported;
}

export { cls };


