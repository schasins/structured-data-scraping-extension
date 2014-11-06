var utilities = {};

utilities.listenForMessage = function(from, to, subject, fn){
  console.log("Listening for messages: "+ from+" : "+to+" : "+subject);
  if (to === "background" || to === "mainpanel"){
    chrome.runtime.onMessage.addListener(function(msg, sender) {
      if (msg.from && (msg.from === from) && 
        msg.subject && (msg.subject === subject)) {
        msg.content.tab_id = sender.tab.id;
        console.log("Receiving message: ", msg);
        console.log("from tab id: ", sender.tab.id);
      fn(msg.content);
    }
  });
  }
  else if (to === "content"){
    chrome.extension.onMessage.addListener(function(msg, sender) {
      var frame_id = SimpleRecord.getFrameId();
      if (msg.frame_ids_include && msg.frame_ids_include.indexOf(frame_id) < -1){
        console.log("Msg for frames with ids "+msg.frame_ids_include+", but this frame has id "+frame_id+".");
        return;
      }
      if (msg.frame_ids_exclude && msg.frame_ids_exclude.indexOf(frame_id) > -1){
        console.log("Msg for frames without ids "+msg.frame_ids_exclude+", but this frame has id "+frame_id+".");
        return;
      }
      if (msg.from && (msg.from === from) && 
        msg.subject && (msg.subject === subject)) {
        console.log("Receiving message: ", msg);
      fn(msg.content);
    }
  });
  }
};

utilities.sendMessage = function(from, to, subject, content, frame_ids_include, frame_ids_exclude, tab_ids_include, tab_ids_exclude){
  if ((from ==="background" || from ==="mainpanel") && to === "content"){
    var msg = {from: from, subject: subject, content: content, frame_ids_include: frame_ids_include, frame_ids_exclude: frame_ids_exclude};
    console.log("Sending message: ", msg);
    console.log(tab_ids_include, tab_ids_exclude);
    if (tab_ids_include){
      for (var i =0; i<tab_ids_include.length; i++){
        chrome.tabs.sendMessage(tab_ids_include[i], msg); 
      } 
      console.log("(Sent to ", tab_ids_include.length, " tabs: ", tab_ids_include, " )");
    }
    else{
        chrome.tabs.query({windowType: "normal"}, function(tabs){
          tabs_messaged = 0;
          for (var i =0; i<tabs.length; i++){
            if (!(tab_ids_exclude && tab_ids_exclude.indexOf(tabs[i].id) > -1)){
              chrome.tabs.sendMessage(tabs[i].id, msg); 
              tabs_messaged ++;
            }
          }
          console.log("(Sent to "+tabs_messaged+" tabs.)");
      });
    }
  }
  else if (from === "content") {
    var msg = {from: "content", subject: subject, content: content};
    console.log("Sending message: ", msg);
    chrome.runtime.sendMessage(msg);
  }
};
