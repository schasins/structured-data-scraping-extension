function ParameterizedTrace(trace){
	var trace = trace;
	var frames = {};
	
	/* xpath parameterization */

	this.parameterizeXpath = function(parameter_name, original_value) {
		original_value = original_value.toUpperCase();
		for (var i = 0; i< trace.length; i++){
			if (trace[i].type !== "dom"){ continue;}
			if (trace[i].target.xpath.name){
				//this one has already been converted to an object, parameterized
				return;
			}
			var xpath = trace[i].target.xpath.toUpperCase();
			if (xpath === original_value){
				console.log("putting a hole in for an xpath", original_value);
				trace[i].target.xpath = {"name": parameter_name, "value": null};
			}
		}
	};

	this.useXpath = function(parameter_name, value) {
		for (var i = 0; i< trace.length; i++){
			if (trace[i].type !== "dom"){ continue;}
			var xpath = trace[i].target.xpath;
			if (xpath["name"] === parameter_name){
				console.log("use xpath", value);
				trace[i].target.xpath = {"name": parameter_name, "value": value};
			}
		}
	};
	
	/* user-typed string parameterization */
	
	var first_event_type = "keydown";
	var last_event_type = "keyup";
	var data_carrier_type = "textInput";
	
	this.parameterizeTypedString = function(parameter_name, original_string){
		var curr_string = "";
		var char_indexes = [];
		var started_char = false;
		for (var i = 0; i< trace.length; i++){
			if (trace[i].type !== "dom"){ continue;} //ok to drop these from script, so ok to skip
			var event_data = trace[i].data;
			if (_.contains(["keydown", "keypress", "keyup", "input", "textInput"], event_data["type"])){
				//starting a new character
				if (event_data["type"] === first_event_type && !started_char){
					char_indexes.push(i);
					started_char = true;
				}
				else if (event_data["type"] === data_carrier_type){
					curr_string += event_data.data;
				}
				else if (event_data["type"] === last_event_type){
					started_char = false;
				}
			}
			else{
				//no more entries into this string, have a non-key event
				processString(parameter_name, original_string, curr_string, char_indexes);
				curr_string_chars = [];
			}
		}
	};
	
	function processString(parameter_name, original_string, string, char_indexes){
		var original_string_initial_case = original_string;
		original_string = original_string.toLowerCase();
		string = string.toLowerCase();
		var orig_i = string.indexOf(original_string);
		if (orig_i > -1){
			//we've found the target string in the typed text, must param
			var one_key_start_index = char_indexes[orig_i];
			var post_char_index = char_indexes[orig_i + original_string.length - 1] + 
				char_indexes[orig_i+1] - char_indexes[orig_i];
			var text_input_event = null;
			for (var i = one_key_start_index; i++ ; i < post_char_index){
				var event = trace[i];
				if (event.type === "dom" && event.data.type === "textInput"){
					text_input_event = event;
					break;
				}
			}
			//now make our param event
			var param_event = {"type": "string_parameterize", 
			"parameter_name": parameter_name, 
			"text_input_event": text_input_event, 
			"orig_value": original_string_initial_case,
			"value": ""};
			//now remove the unnecessary events, replace with param event
			trace = trace.slice(0,one_key_start_index)
			.concat([param_event])
			.concat(trace.slice(post_char_index, trace.length));
		}
	}
	
	this.useTypedString = function(parameter_name, string){
		for (var i=0; i< trace.length; i++){
			var event = trace[i];
			if (event["type"] === "string_parameterize" && event["parameter_name"] === parameter_name){
				event["value"] = string;
			}
		}
	};
	
	
	/* frame parameterization */
	
	this.parameterizeFrame = function(parameter_name, original_value) {
		frames[parameter_name] = {original_value: original_value};
	};

	this.useFrame = function(parameter_name, value) {
		if(value === null){
			console.log("Freak out.");
		}
		frames[parameter_name]["value"] = value;
	};
	
	//TODO tabs: create a parameterize on frame or tab.  not yet sure which
	//we'll be using it for cases where a demonstration does something on a list page
	//could be the first list page, in which case tab always the same, but could
	//also be a nested list page, in which case tab will change
	
	/* using current arguments, create a standard, replayable trace */
	
	function deltaReplace(deltas, prop_to_change, orig_value, replace_value){
		for (var j = 0; j<deltas.length; j++){
			var delta = deltas[j];
			delta.changed.prop[prop_to_change] = delta.changed.prop[prop_to_change].replace(orig_value, replace_value);
		}
	}
	
	this.getStandardTrace = function(){
		console.log("about to clone trace ", trace);
		var cloned_trace = clone(trace);
		console.log("successfully cloned trace");
		var prop_corrections = {};
		for (var i = 0; i< cloned_trace.length; i++){
			if (cloned_trace[i].type === "dom"){
				//do any prop corrections we might need, as when we've recorded a value but what to enforce a diff
				if (cloned_trace[i].meta.nodeSnapshot && cloned_trace[i].meta.nodeSnapshot.prop){
					var xpath = cloned_trace[i].meta.nodeSnapshot.prop.xpath;
					for (var correction_xpath in prop_corrections){
						if (xpath === correction_xpath){
							var d = prop_corrections[correction_xpath];
							deltaReplace(cloned_trace[i].meta.deltas, d.prop, d.orig_value, d.value);		
						}
					}
				}
				//correct xpath if it's a parameterized xpath
				var xpath = cloned_trace[i].target.xpath;
				if (xpath["name"]){
					console.log("Correcting xpath to ", xpath["value"]);
					cloned_trace[i].target.xpath = xpath["value"];
					cloned_trace[i].target.useXpathOnly = true;
				}
			}
			else if (cloned_trace[i].type === "string_parameterize"){
				var new_event = cloned_trace[i].text_input_event;
				new_event.data.data = cloned_trace[i].value;
				deltaReplace(new_event.meta.deltas, "value", cloned_trace[i].orig_value, cloned_trace[i].value);
				prop_corrections[new_event.meta.nodeSnapshot.prop.xpath] = 
				{"prop": "value", 
				"orig_value": cloned_trace[i].orig_value, 
				"value": cloned_trace[i].value};
				cloned_trace = cloned_trace.slice(0,i)
				.concat([new_event])
				.concat(cloned_trace.slice(i+1,cloned_trace.length));
			}
		}
		return cloned_trace;
	};
	
	this.getConfig = function(){
		console.log("frames", frames);
		var config = {};
		config["frameMapping"] = {};
		for (var param in frames){
			config["frameMapping"][frames[param]["original_value"]] = frames[param]["value"];
		}
		console.log("config", config);
		return config;
	};
}
