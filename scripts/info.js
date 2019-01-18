const fs = require('fs');
const _ = require('lodash');

const files = fs.readdirSync('./dist/controller');
const jss = files.filter(o => o.endsWith('.js'));

const type = process.argv[2] || 'endpoint';

if (type === 'env') {
  const constant = require('./dist/interface/constant.js');
  constant.constant.logEnvs(console.log);
  return;
}

if (type !== 'rpc' && type !== 'endpoint') {
  console.error('process.argv[2] should be rpc or endpoint')
  process.exit(1);
}

function hasMethod(o) {
  return {
    get: 1,
    put: 1,
    post: 1,
    del: 1
  }[o.name.toLowerCase().split(' ')[0]];
}

const filters = {
  rpc: o => o && !hasMethod(o),
  endpoint: o => o && hasMethod(o)
}

const sorts = {
  rpc: o => o.name,
  endpoint: o => o.name.split(' ')[1]
}

const printers = {
  rpc: o => console.log(o.name),
  endpoint: o => {
    const [method, url] = o.name.split(' ');
    console.log(_.padEnd(method, 5, ' ') + url);
  }
}

const items = _(jss).map(o => {
  const c = require('./dist/controller/' + o);
  const controllers = Object.keys(c).filter(o => o.endsWith('Controller')).map(o => c[o]);
  return _.flatten(controllers.map(o => o._endpointMethods));
}).flatten().filter(filters[type]).sortBy(sorts[type]).value();

items.forEach(printers[type]);
