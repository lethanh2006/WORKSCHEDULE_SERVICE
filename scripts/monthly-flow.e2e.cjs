/* Isolated HTTP integration: real Gateway + work schedule service + Mongo replica set.
 * Auth introspection/directory use local fixtures; no requests reach existing user data.
 */
const assert = require('node:assert/strict');
const { createHmac, randomBytes } = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { MongoClient, ObjectId } = require('mongoose').mongo;
const { setTimeout: pause } = require('node:timers/promises');
const root = path.resolve(__dirname, '..');
const gatewayRoot = path.resolve(root, '../gateway');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nrapp-monthly-e2e-'));
const children = [];
const secret = randomBytes(32).toString('hex');
let mongo, fixture, container;

async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function waitFor(check, label, timeout = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { if (await check()) return; } catch {}
    await pause(250);
  }
  throw new Error(`Timeout: ${label}. Logs: ${temp}`);
}
function start(command, args, cwd, env, name) {
  const log = fs.openSync(path.join(temp, `${name}.log`), 'a');
  const child = spawn(command, args, { cwd, env, stdio: ['ignore', log, log] });
  children.push(child);
  child.on('error', error => { console.error(`${name}: ${error.message}`); });
  return child;
}
function token(user) {
  const encode = object => Buffer.from(JSON.stringify(object)).toString('base64url');
  const data = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user._id, role: user.role, exp: Math.floor(Date.now()/1000) + 3600 })}`;
  return `${data}.${createHmac('sha256', secret).update(data).digest('base64url')}`;
}
async function main() {
  const [mongoPort, backendPort, gatewayPort, fixturePort] = await Promise.all(Array.from({length:4}, freePort));
  const uri = `mongodb://127.0.0.1:${mongoPort}/nrapp?directConnection=true`;
  if (process.env.MONGOD_BINARY) {
    const dbPath = path.join(temp, 'db'); fs.mkdirSync(dbPath);
    start(process.env.MONGOD_BINARY, ['--dbpath', dbPath, '--replSet', 'nrappTest', '--port', String(mongoPort), '--bind_ip', '127.0.0.1', '--quiet'], root, process.env, 'mongo');
  } else {
    container = `nrapp-monthly-e2e-${process.pid}`;
    execFileSync('docker', ['run', '--rm', '-d', '--name', container, '-p', `127.0.0.1:${mongoPort}:${mongoPort}`, 'mongo:7.0', '--replSet', 'nrappTest', '--port', String(mongoPort), '--bind_ip_all'], {stdio:'pipe'});
  }
  mongo = new MongoClient(uri, { serverSelectionTimeoutMS: 500 });
  await waitFor(() => mongo.connect().then(() => true), 'MongoDB');
  await mongo.db('admin').command({ replSetInitiate: { _id:'nrappTest', members:[{_id:0,host:`127.0.0.1:${mongoPort}`}] } });
  await waitFor(async () => (await mongo.db('admin').command({ hello:1 })).isWritablePrimary, 'Replica primary');
  const db = mongo.db('nrapp');
  // Exercise the index migration with a real legacy index before service startup.
  await db.collection('schedulerequests').createIndex({employee_id:1, week_start:1}, {unique:true});
  const users = Array.from({length:6}, (_, index) => ({ _id: new ObjectId().toHexString(), username:`Kiểm tra ${index}`, email:`test-${index}@example.test`, role:index===0?'admin':'user' }));
  const tokens = new Map(users.map(user => [token(user), user]));
  fixture = http.createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    const identity = tokens.get((request.headers.authorization || '').replace('Bearer ', ''));
    if (request.url === '/api/auth/introspect') {
      response.statusCode = identity ? 200 : 401;
      response.end(JSON.stringify({valid:Boolean(identity), user:identity}));
    } else if (request.url === '/api/user/user/all') response.end(JSON.stringify({users}));
    else if (request.url === '/api/user/me' && identity) response.end(JSON.stringify({user:identity}));
    else { response.statusCode=404; response.end('{}'); }
  });
  await new Promise(resolve => fixture.listen(fixturePort,'127.0.0.1',resolve));
  const env = {...process.env, NODE_ENV:'test', LOG_FORMAT:'json', OTEL_SDK_DISABLED:'true', JWT_SECRET:secret, USER_INTERNAL_SECRET:secret, WORKSCHEDULE_INTERNAL_SECRET:secret,
    MONGO_URL:uri, AUTH_SERVICE_URL:`http://127.0.0.1:${fixturePort}`, USER_SERVICE_URL:`http://127.0.0.1:${fixturePort}`, WORKSCHEDULE_SERVICE_URL:`http://127.0.0.1:${backendPort}`};
  start(process.execPath,['dist/main.js'],root,{...env,PORT:String(backendPort)},'workschedule');
  await waitFor(async () => (await fetch(`http://127.0.0.1:${backendPort}/health/ready`)).ok, 'Work schedule ready');
  start(process.execPath,['dist/main.js'],gatewayRoot,{...env,PORT:String(gatewayPort)},'gateway');
  await waitFor(async () => (await fetch(`http://127.0.0.1:${gatewayPort}/health`)).ok, 'Gateway ready');
  const base = `http://127.0.0.1:${gatewayPort}/api/workschedule`;
  async function call(method, endpoint, user = users[0], body, expected) {
    const response = await fetch(base+endpoint, {method, headers:{Authorization:`Bearer ${token(user)}`,'Content-Type':'application/json'}, ...(body === undefined ? {} : {body:JSON.stringify(body)})});
    const result = await response.json();
    if (expected !== undefined) assert.equal(response.status, expected, `${method} ${endpoint}: ${JSON.stringify(result)}`);
    return {status:response.status, ...result};
  }
  const today = new Date(Date.now()+7*3600_000).toISOString().slice(0,10);
  const month = today.slice(0,7);
  const [year,number] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year,number,0)).toISOString().slice(0,10);
  const nextMonth = new Date(Date.UTC(year,number,1)).toISOString().slice(0,7);
  const entry = (date=today, type='office', period='full_day') => ({date,type,period});
  await call('PATCH','/policy',users[1],{locked:false},403);
  await call('PATCH','/policy',users[0],{registration_start:`${today}T00:00:00+07:00`,registration_end:`${nextMonth}-02T23:59:59+07:00`,locked:false},400);
  const opened = await call('PATCH','/policy',users[0],{registration_start:`${today}T00:00:00+07:00`,registration_end:`${lastDay}T23:59:59+07:00`,locked:false},200);
  assert.equal(opened.data.schedule_month,month);
  await call('POST','/schedule/requests',users[1],{month:nextMonth,entries:[entry(`${nextMonth}-01`)]},400);
  const dates=[...new Set([today,lastDay])];
  const created = await call('POST','/schedule/requests',users[1],{month,entries:dates.map(date=>entry(date,'remote','morning'))},201);
  const id=created.data._id;
  await call('POST','/schedule/requests',users[1],{month,entries:[entry()]},400);
  const list=await call('GET',`/schedule/all?month=${month}`,users[0],undefined,200);
  assert.equal(list.data.find(request=>request._id===id).entries.length,dates.length);
  await call('POST',`/schedule/requests/${id}/reject`,users[0],{reason:'Điều chỉnh ca'},200);
  const competing=await Promise.all(['morning','afternoon'].map(period=>call('POST',`/schedule/requests/${id}/resubmit`,users[1],{entries:dates.map(date=>entry(date,'remote',period))})));
  assert.equal(competing.filter(result=>result.status===200).length,1,'Only one resubmit may succeed');
  await call('POST',`/schedule/requests/${id}/approve`,users[0],{},200);
  const final=await call('GET',`/schedule/requests/${id}`,users[0],undefined,200);
  const attendance=await db.collection('attendancerecords').find({employee_id:new ObjectId(users[1]._id),source:'schedule'}).toArray();
  assert.equal(attendance.length,dates.length);
  const expectedHour=final.data.entries[0].period==='morning'?5:10; // 12:00 / 17:30 Vietnam in UTC.
  assert(attendance.every(record=>record.check_out_at.getUTCHours()===expectedHour),'Attendance matches accepted resubmission');
  const concurrentCreate=await Promise.all(Array.from({length:5},()=>call('POST','/schedule/requests',users[2],{month,entries:[entry()]})));
  assert.equal(concurrentCreate.filter(result=>result.status===201).length,1);
  const mixed=await call('POST','/schedule/requests',users[3],{month,entries:[entry(today,'remote','morning')]},201);
  const approveEdit=await Promise.all([
    call('POST',`/schedule/requests/${mixed.data._id}/approve`,users[0],{}),
    call('PATCH',`/schedule/requests/${mixed.data._id}`,users[0],{entries:[entry(today,'remote','afternoon')]}),
  ]);
  assert(approveEdit.every(result=>result.status===200),JSON.stringify(approveEdit));
  const current=await call('GET',`/schedule/requests/${mixed.data._id}`,users[0],undefined,200);
  const record=await db.collection('attendancerecords').findOne({employee_id:new ObjectId(users[3]._id),source:'schedule'});
  assert.equal(current.data.status,'approved');
  assert.equal(record.check_out_at.getUTCHours(),current.data.entries[0].period==='morning'?5:10);
  const yesterday=new Date(new Date(`${today}T00:00:00Z`).getTime()-86400_000).toISOString().slice(0,10);
  await call('POST','/schedule/requests',users[4],{month,entries:[entry(yesterday)]},400);
  const legacyId=new ObjectId();
  await db.collection('schedulerequests').insertOne({_id:legacyId,employee_id:new ObjectId(users[4]._id),week_start:new Date(`${today}T00:00:00Z`),status:'approved'});
  await db.collection('scheduleentries').insertOne({request_id:legacyId,date:new Date(`${today}T00:00:00Z`),type:'office',period:'full_day'});
  await call('POST','/schedule/requests',users[4],{month,entries:[entry()]},400);
  const overview=await call('GET',`/schedule/monthly-overview?month=${month}`,users[1],undefined,200);
  assert.equal(overview.data.entries.length,dates.length);
  assert.equal(overview.data.stats.approved_sessions,dates.length);
  const indexes=await db.collection('schedulerequests').indexes();
  assert(indexes.some(index=>index.name==='employee_id_1_month_1'));
  assert(!indexes.some(index=>index.name==='employee_id_1_week_start_1'));
  await call('PATCH','/policy',users[0],{locked:true},200);
  await call('POST','/schedule/requests',users[5],{month,entries:[entry()]},400);
  await call('POST','/schedule/requests',users[0],{month,entries:[entry()]},400);
  console.log('PASS: Gateway + Mongo thật; mở tháng, phân quyền, lịch sai tháng/quá khứ, đăng ký trùng, gửi lại đồng thời, duyệt/sửa đồng thời, chấm công, tổng hợp tháng, lịch cũ và khóa đợt.');
}
main().catch(error=>{console.error(error);console.error(`Nhật ký: ${temp}`);process.exitCode=1;}).finally(async()=>{
  await mongo?.close();
  fixture?.close();
  for(const child of children.reverse()) child.kill('SIGTERM');
  await pause(500);
  for(const child of children) if(child.exitCode===null) child.kill('SIGKILL');
  if(container) { try {execFileSync('docker',['rm','-f',container],{stdio:'ignore'});} catch {} }
});
