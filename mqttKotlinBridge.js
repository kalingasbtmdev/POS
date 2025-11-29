let mqttUrl;
let mqttOptions;
let localMqttUrl;
let localMqttOptions;
const localClientState = { connecting: false };
let pendingConnectRequestId = null;
let pendingLocalConnectRequestId = null;

const reportCloudResult = (requestId, success, message) => {
  if (!requestId) return;
  window.composeApp.com.kalingas.pos.dev.mqtt.onMqttOperationResult(requestId, success, message || null);
};

const reportLocalResult = (requestId, success, message) => {
  if (!requestId) return;
  window.composeApp.com.kalingas.pos.dev.mqtt.onLocalMqttOperationResult(requestId, success, message || null);
};

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

function connect(requestId) {
  if (!window.mqttClient) {
    if (!mqttUrl || !mqttOptions) {
      createMQTTClient();
    }

    const client = mqtt.connect(mqttUrl, mqttOptions);
    pendingConnectRequestId = requestId || null;

    client.on('connect', () => {
      reportCloudResult(pendingConnectRequestId, true);
      pendingConnectRequestId = null;
      window.composeApp.com.kalingas.pos.dev.mqtt.connectComplete();
    });

    const handleDisconnect = (err) => {
      if (!client.connected && pendingConnectRequestId) {
        reportCloudResult(pendingConnectRequestId, false, err?.message || 'Connection failed');
        pendingConnectRequestId = null;
      }
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
    reportCloudResult(requestId, true);
  }
}

function disconnect(requestId) {
  if (window.mqttClient) {
    const client = window.mqttClient;
    pendingConnectRequestId = null;
    client.end(false, undefined, (err) => {
      reportCloudResult(requestId, !err, err?.message || 'Failed to disconnect');
    });
  } else {
    reportCloudResult(requestId, true);
  }
}

function connectLocal(requestId) {
  const existingClient = window.localMqttClient;
  if (existingClient && (existingClient.connected || localClientState.connecting)) {
    reportLocalResult(requestId, true);
    return;
  }

  if (!existingClient) {
    if (!localMqttUrl || !localMqttOptions) {
      createLocalMQTTClient();
    }

    const client = mqtt.connect(localMqttUrl, localMqttOptions);
    localClientState.connecting = true;
    pendingLocalConnectRequestId = requestId || null;

    client.on('connect', () => {
      localClientState.connecting = false;
      reportLocalResult(pendingLocalConnectRequestId, true);
      pendingLocalConnectRequestId = null;
      window.composeApp.com.kalingas.pos.dev.mqtt.localConnectComplete();
    });

    const handleDisconnect = (err) => {
      localClientState.connecting = false;
      if (!client.connected && pendingLocalConnectRequestId) {
        reportLocalResult(pendingLocalConnectRequestId, false, err?.message || 'Connection failed');
        pendingLocalConnectRequestId = null;
      }
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
    localClientState.connecting = true;
    try {
      existingClient.reconnect();
      reportLocalResult(requestId, true);
    } catch (err) {
      localClientState.connecting = false;
      console.error('Local MQTT reconnect failed', err);
      reportLocalResult(requestId, false, err?.message || 'Reconnect failed');
    }
  }
}

function disconnectLocal(requestId) {
  const client = window.localMqttClient;
  if (client) {
    localClientState.connecting = false;
    pendingLocalConnectRequestId = null;
    try {
      client.end(true, undefined, (err) => {
        if (!err) {
          window.localMqttClient = null;
        }
        reportLocalResult(requestId, !err, err?.message || 'Failed to disconnect');
      });
    } catch (err) {
      console.error('Local MQTT disconnect failed', err);
      reportLocalResult(requestId, false, err?.message || 'Failed to disconnect');
    }
  } else {
    reportLocalResult(requestId, true);
  }
}

function publish(requestId, topic, message) {
  if (window.mqttClient) {
    window.mqttClient.publish(topic, message, { qos: 2 }, (err) => {
      if (err) console.error('Publish failed:', err);
      reportCloudResult(requestId, !err, err?.message || 'Publish failed');
    });
  } else {
    reportCloudResult(requestId, false, 'Client not connected');
  }
}

function subscribe(requestId, topic) {
  if (window.mqttClient) {
    window.mqttClient.subscribe(topic, { qos: 1 }, (err) => {
      if (err) console.error('Subscription failed', err);
      reportCloudResult(requestId, !err, err?.message || 'Subscription failed');
    });
  } else {
    reportCloudResult(requestId, false, 'Client not connected');
  }
}

function unsubscribe(requestId, topic) {
  if (window.mqttClient) {
    window.mqttClient.unsubscribe(topic, (err) => {
      if (err) console.error('Unsubscribe failed:', err);
      reportCloudResult(requestId, !err, err?.message || 'Unsubscribe failed');
    });
  } else {
    reportCloudResult(requestId, false, 'Client not connected');
  }
}

function publishLocal(requestId, topic, message) {
  if (window.localMqttClient) {
    window.localMqttClient.publish(topic, message, { qos: 2 }, (err) => {
      if (err) console.error('Local publish failed:', err);
      reportLocalResult(requestId, !err, err?.message || 'Publish failed');
    });
  } else {
    reportLocalResult(requestId, false, 'Client not connected');
  }
}

function subscribeLocal(requestId, topic) {
  if (window.localMqttClient) {
    window.localMqttClient.subscribe(topic, { qos: 2 }, (err) => {
      if (err) console.error('Local subscription failed', err);
      reportLocalResult(requestId, !err, err?.message || 'Subscription failed');
    });
  } else {
    reportLocalResult(requestId, false, 'Client not connected');
  }
}

function unsubscribeLocal(requestId, topic) {
  if (window.localMqttClient) {
    window.localMqttClient.unsubscribe(topic, (err) => {
      if (err) console.error('Local unsubscribe failed:', err);
      reportLocalResult(requestId, !err, err?.message || 'Unsubscribe failed');
    });
  } else {
    reportLocalResult(requestId, false, 'Client not connected');
  }
}
