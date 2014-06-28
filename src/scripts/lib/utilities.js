var utilities = {};

utilities.listenForMessage = function(from, to, subject,fn){
  console.log("Listening for messages: "+ from+" : "+to+" : "+subject);
  if (to === "background" || to === "mainpanel"){
    chrome.runtime.onMessage.addListener(function(msg, sender) {
      console.log(msg);
      if (msg.from && (msg.from === from)
		      && msg.subject && (msg.subject === subject)) {
	      fn(msg.content);
      }
    });
  }
  else if (to === "content"){
    chrome.extension.onMessage.addListener(function(msg, sender) {
      console.log(msg);
      if (msg.from && (msg.from === from)
	      && msg.subject && (msg.subject === subject)) {
	  fn(msg.content);
      }
    });
  }
}

utilities.sendMessage = function(from, to, subject, content){
  console.log("Sending message: ");
  if ((from ==="background" || from ==="mainpanel") && to === "content"){
	var msg = {from: from, subject: subject, content: content};
	console.log(msg);
    chrome.tabs.query({windowType: "normal"}, function(tabs){
	  console.log("Sending to "+tabs.length+" tabs.");
      for (i =0; i<tabs.length; i++){
	chrome.tabs.sendMessage(tabs[i].id, msg); 
      }
    });
  }
  else if (from === "content") {
    var msg = {from: "content", subject: subject, content: content};
    console.log(msg);
    chrome.runtime.sendMessage(msg);
  }
}
