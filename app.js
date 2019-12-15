var mosca = require('mosca');
var fsMoudle=require('fs');
var mqttClientManager = require('mqtt')
var redis = require('redis')
var clientMap = new Map()
var subscribeMap = new Map()
var g_localInfo = ""
var g_serverPort = 0
var cfgFile="./config.json";
var cfgObject=JSON.parse(fsMoudle.readFileSync(cfgFile));
var clientRedis = redis.createClient(cfgObject.rediscfg.port, cfgObject.rediscfg.ip);
const os = require('os');

var arguments = process.argv.splice(2);

if(arguments.length !== 1) {
  console.log('参数个数错误');
  process.exit()
}
if(isNaN(arguments[0])){
  console.log('参数类型错误');
  process.exit()
}

g_serverPort = parseInt(arguments[0]);

var ascoltatore = {

};

var settings = {
  port: g_serverPort,
  backend: ascoltatore
};

var server = new mosca.Server(settings);

///////////////////获取本机ip///////////////////////
function getIPAdress() {
  var interfaces = os.networkInterfaces();

  for (var devName in interfaces) {
    if (cfgObject.netcard !== "" && cfgObject.netcard !== devName) {
      continue;
    }
    var iface = interfaces[devName];

    for (var i = 0; i < iface.length; i++) {
      var alias = iface[i];
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
        return alias.address;
      }
    }
  }
}

function getLocalInfo() {
  var selfConfig = getIPAdress()
  selfConfig += ":"
  selfConfig += g_serverPort
  
  return selfConfig;
}

function initConfig(){
  g_localInfo = getLocalInfo()
  clientRedis.sadd("Clusterlist", g_localInfo);
}

function getClusterlist() {
  //获取集群列表
  clientRedis.smembers("Clusterlist", (err, memberlist) => {
    if (!err) {
      memberlist.forEach(elem => {
        if (elem != g_localInfo && !clientMap.has(elem)) {
          //创建动态订阅客户端
          var clientInfo = 'Cluster_' + g_localInfo;
          var client = mqttClientManager.connect('mqtt://' + elem, {
            //    username:'13800000000',
            //    password:'123456',
            clientId: clientInfo
          })
          clientMap.set(elem, client)

          client.on('message', function (topic, message) {
            console.log(topic, message)
            var qtt={}; //定义消息（可以为字符串、对象等）
            qtt.topic = topic;
            qtt.payload = message;
            server.publish(qtt)
          })
        }
      });
    }
  })
}

// fired when the mqtt server is ready
function readyServer() {
  console.log('Mosca server is up and running')

  initConfig()
  setInterval(getClusterlist, 5)
}

function run() {
  server.on('clientConnected', function (client) {
    console.log('client connected', client.id);
  });

  // fired when a message is received
  server.on('published', function (packet, client) {
    console.log('Published', packet.payload);
  });

  server.on('subscribed', function (topic, client) {
    if (client.id.includes('Cluster_')) {
      return
    }

    if (!subscribeMap.has(topic)) {
      subscribeMap.set(topic, 1)
      for (var [key, cli] of clientMap) {
        cli.subscribe(topic)
        console.log("Key", key, 'subscribed', topic);
      }
    }
    else {
      var subCount = subscribeMap.get(topic) + 1
      subscribeMap.set(topic, subCount)
    }
  });

  server.on('unSubscribed', function (topic, client) {
    if (subscribeMap.has(topic)) {
      var subCount = subscribeMap.get(topic) - 1
      if (subCount === 0) {
        for (var [key, cli] of clientMap) {
          cli.unsubscribe(topic)
          console.log("Key", key, 'unsubscribe', topic);
        }
      }
    }

    console.log('unSubscribed: ', topic);
  })

  server.on('ready', readyServer);
}

run()
