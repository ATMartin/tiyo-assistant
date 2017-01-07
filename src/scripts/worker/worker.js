(function(tiy){
  const hostName = "com.theironyard.newlinecli.hw";
  let connection;
  let pendingPromises = [];

  tiy.worker.connect = connect;
  tiy.worker.onNativeMessage = onNativeMessage;
  tiy.worker.sendNativeMessage = sendNativeMessage;
  tiy.worker.onDisconnected = onDisconnected;
  tiy.worker.pendingPromises = pendingPromises;

  function connect() {
    console.log("Connecting to native messaging host", hostName)
    connection = chrome.runtime.connectNative(hostName);
    connection.onMessage.addListener(onNativeMessage);
    connection.onDisconnect.addListener(onDisconnected);
  }

  function onNativeMessage(msg) {
    console.log("Message from host", msg);
    if (msg.message_id) {
      let findByMessageId = function (el) { return msg.message_id === el.message_id }
      let itemInQueue = pendingPromises.find(findByMessageId);
      let itemIndex = pendingPromises.findIndex(findByMessageId);
      if (itemInQueue) {

        if (msg.status == "ok") {
          itemInQueue.complete = true;
          itemInQueue.resolve(msg);
        } else  {
          itemInQueue.reject(msg);
        }

        itemInQueue.complete = true;
        pendingPromises.splice(itemIndex, 1);
      }
    }
  }

  function sendNativeMessage(event, data) {
    if (!connection) {
      connect();
    }
    const id = Date.now();
    let resolve;
    let reject;

    let promise  = new Promise(function (res, rej){
      const payload = { event: event, message_id: id,  data: data };
      console.log("Sending Data to NewlineHW", payload);
      connection.postMessage(payload);
      resolve = res;
      reject = rej;
    });

    let item = {
      message_id: id,
      resolve,
      reject,
      complete: false
    };

    setTimeout(function killItem() {
      if (!item.complete) {
        item.reject('Timeout');
        item = null;
      }
    }, 3000);

    pendingPromises.push(item);
    return promise;
  }

  function onDisconnected(message) {
    console.error("Failed to connect: " + chrome.runtime.lastError.message);
    pendingPromises.forEach(function closePromise(item) {
      item.reject(chrome.runtime.lastError.message);
    })
    pendingPromises = [];
    connection = null;
  }

  chrome.runtime.onMessage.addListener( function(request, sender, sendResponse) {
    console.log(sender.tab ?
                "from a content script:" + sender.tab.url : "from the extension");
    sendNativeMessage(request.event, request.data).then(function (msg) {
      console.log("sending data to frontend", msg);
      sendResponse(msg);
    }).catch(function (msg) {
      sendResponse(msg);
    });
    return true;
  });

  window.tiy = tiy;


})(window.tiy || { worker: {} });