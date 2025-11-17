let mqttUrl;
let mqttOptions;
let localMqttUrl;
let localMqttOptions;

function createMQTTClient() {
  const hostname = window.composeApp.com.kalingas.pos.dev.mqtt.getMqttUrl();
  const port = window.composeApp.com.kalingas.pos.dev.mqtt.getMqttPort();

  mqttUrl = `wss://${hostname}:${port}/mqtt`;

  const clientId = "clientId_" + Math.random().toString(36).substring(2, 15);
  mqttOptions = {
    clientId,
    clean: true,
    connectTimeout: 30_000,
    username: window.composeApp.com.kalingas.pos.dev.mqtt.getMqttUserName(),
    password: window.composeApp.com.kalingas.pos.dev.mqtt.getMqttPassword(),
    ca: window.composeApp.com.kalingas.pos.dev.mqtt.getMqttCertificatePem()
  };
}

function createLocalMQTTClient() {
  const hostname = window.composeApp.com.kalingas.pos.dev.mqtt.getLocalBrokerHost();
  const port = window.composeApp.com.kalingas.pos.dev.mqtt.getLocalBrokerPort();

  localMqttUrl = `ws://${hostname}:${port}/mqtt`;

  const clientId = "localClientId_" + Math.random().toString(36).substring(2, 15);
  localMqttOptions = {
    clientId,
    clean: true,
    connectTimeout: 30_000
  };
}

function connect() {
  if (!window.mqttClient) {
    if (!mqttUrl || !mqttOptions) {
      createMQTTClient();
    }

    const client = mqtt.connect(mqttUrl, mqttOptions);

    client.on('connect', () => {
      window.composeApp.com.kalingas.pos.dev.mqtt.connectComplete();
    });

    const handleDisconnect = (err) => {
      const msg = err?.message || 'Connection lost';
      window.composeApp.com.kalingas.pos.dev.mqtt.connectionLost(msg);
    };
    client.on('close', handleDisconnect);
    client.on('error', handleDisconnect);

    client.on('message', (topic, payload) => {
      window.composeApp.com.kalingas.pos.dev.mqtt.messageArrived(topic, payload.toString());
    });

    window.mqttClient = client;
  } else {
    window.mqttClient.reconnect();
  }
}

function disconnect() {
  if (window.mqttClient) {
    window.mqttClient.end();
  }
}

function connectLocal() {
  if (!window.localMqttClient) {
    if (!localMqttUrl || !localMqttOptions) {
      createLocalMQTTClient();
    }

    const client = mqtt.connect(localMqttUrl, localMqttOptions);

    client.on('connect', () => {
      window.composeApp.com.kalingas.pos.dev.mqtt.localConnectComplete();
    });

    const handleDisconnect = (err) => {
      const msg = err?.message || 'Connection lost';
      window.composeApp.com.kalingas.pos.dev.mqtt.localConnectionLost(msg);
    };
    client.on('close', handleDisconnect);
    client.on('error', handleDisconnect);

    client.on('message', (topic, payload) => {
      window.composeApp.com.kalingas.pos.dev.mqtt.localMessageArrived(topic, payload.toString());
    });

    window.localMqttClient = client;
  } else {
    window.localMqttClient.reconnect();
  }
}

function disconnectLocal() {
  if (window.localMqttClient) {
    window.localMqttClient.end();
  }
}

function publish(topic, message) {
  if (window.mqttClient) {
    window.mqttClient.publish(topic, message, { qos: 1 }, (err) => {
      if (err) console.error('Publish failed:', err);
    });
  }
}

function subscribe(topic) {
  if (window.mqttClient) {
    window.mqttClient.subscribe(topic, { qos: 1 }, (err) => {
      if (err) console.error('Subscription failed', err);
    });
  }
}

function unsubscribe(topic) {
  if (window.mqttClient) {
    window.mqttClient.unsubscribe(topic, (err) => {
      if (err) console.error('Unsubscribe failed:', err);
    });
  }
}

function publishLocal(topic, message) {
  if (window.localMqttClient) {
    window.localMqttClient.publish(topic, message, { qos: 1 }, (err) => {
      if (err) console.error('Local publish failed:', err);
    });
  }
}

function subscribeLocal(topic) {
  if (window.localMqttClient) {
    window.localMqttClient.subscribe(topic, { qos: 1 }, (err) => {
      if (err) console.error('Local subscription failed', err);
    });
  }
}

function unsubscribeLocal(topic) {
  if (window.localMqttClient) {
    window.localMqttClient.unsubscribe(topic, (err) => {
      if (err) console.error('Local unsubscribe failed:', err);
    });
  }
}
