/* tslint:disable */
// Don't import any module! this file use hack!
let ISLAND_USE_CLS = !(process.env.ISLAND_USE_CLS == 'false');
let cls;

if (ISLAND_USE_CLS) {
  cls = require('continuation-local-storage');
  const ns = cls.getNamespace('app') || cls.createNamespace('app');
  require('cls-mongoose')(ns);
  require('cls-bluebird')(ns);
} else {
  cls = require('./mock-cls');
  cls.getNamespace('app') || cls.createNamespace('app');
}
cls.init = () => {
// make sure it is always imported;
};

export { cls };
