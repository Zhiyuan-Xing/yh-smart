# yh-smart
这一个基于nodejs Mosca和Redis实现的Mqtt集群服务
很简陋的简单实现，目前仅实现了简单的集群功能，方案为动态订阅方式，每个server既是订阅者优势发布者。
下面对配置文件config.json的配置项作说明
  netcard针对多网卡的PC机，选择网卡用
  rediscfg为对redis的配置
    其中ip为redis的地址，port为redis服务使用的端口号

启动方式：
命令行输入  node app.js + 服务端口
例如 node app.js 1884
