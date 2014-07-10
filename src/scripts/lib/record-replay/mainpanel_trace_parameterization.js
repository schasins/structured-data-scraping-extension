function ParameterizedTrace(trace){
    var trace = trace;
    
    /* xpath parameterization */

    this.parameterizeXpath = function(parameter_name, original_value) {
        for (var i = 0; i< trace.length; i++){
			if (trace[i].type !== "dom"){ continue;}
			var xpath = trace[i].value.data.target.xpath;
			if (xpath === original_value){
				trace[i].value.data.target.xpath = {"name": parameter_name, "value": null};
			}
		}
    }

    this.useXpath = function(parameter_name, value) {
        for (var i = 0; i< trace.length; i++){
			if (trace[i].type !== "dom"){ continue;}
			var xpath = trace[i].value.data.target.xpath;
			if (xpath["name"] === parameter_name){
				trace[i].value.data.target.xpath = {"name": parameter_name, "value": value};
			}
		}
    }
    
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
			var event_data = trace[i].value.data;
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
	}
	
	function processString(parameter_name, original_string, string, char_indexes){
		console.log(string);
		console.log(char_indexes);
		original_string = original_string.toLowerCase();
		string = string.toLowerCase();
		var orig_i = string.indexOf(original_string);
		if (orig_i > -1){
			//we've found the target string in the typed text, must param
			var one_key_start_index = char_indexes[orig_i];
			var post_char_index = char_indexes[orig_i+original_string.length - 1] + char_indexes[orig_i+1] - char_indexes[orig_i];
			var text_input_event = null;
			for (var i = one_key_start_index; i++ ; i < post_char_index){
				var event = trace[i];
				if (event.type === "dom" && event.value.data.type === "textInput"){
					text_input_event = event;
					break;
				}
			}
			//now make our param event
			var param_event = {"type": "string_parameterize", "parameter_name": parameter_name, "text_input_event": text_input_event};
			//now remove the unnecessary events, replace with our param event
			trace = trace.slice(0,one_key_start_index).concat([param_event]).concat(trace.slice(post_char_index, trace.length));
		}
	}
	
	this.useTypedString = function(parameter_name, string){
		for (var i=0; i< trace.length; i++){
			var event = trace[i];
			if (event["type"] === "string_parameterize" && event["parameter_name"] === parameter_name){
				event["value"] = string;
			}
		}
	}
    
    /* using current arguments, create a standard, replayable trace */
    
    this.standardTrace = function(){
		var cloned_trace = clone(trace);
		var prop_corrections = {};
        for (var i = 0; i< cloned_trace.length; i++){
			if (cloned_trace[i].type === "dom"){
				//do any prop corrections we might need, as when we've recorded a value but what to enforce a diff
				if (cloned_trace[i].value.meta.nodeSnapshot && cloned_trace[i].value.meta.nodeSnapshot.prop){
					var xpath = cloned_trace[i].value.meta.nodeSnapshot.prop.xpath;
					for (var correction_xpath in prop_corrections){
						if (xpath === correction_xpath){
							var prop = prop_corrections[correction_xpath]["prop"];
							var val = prop_corrections[correction_xpath]["value"];
							cloned_trace[i].value.meta.nodeSnapshot.prop[prop] = val;
							console.log(cloned_trace[i].value.data.type+": replacing "+prop+" with "+val);
						}
					}
				}
				//correct xpath if it's a parameterized xpath
				var xpath = cloned_trace[i].value.data.target.xpath;
				if (xpath["name"]){
					cloned_trace[i].value.data.target.xpath = xpath["value"];
				}
			}
			else if (cloned_trace[i].type === "string_parameterize"){
				var new_event = cloned_trace[i].text_input_event;
				new_event.value.data.data = cloned_trace[i].value;
				new_event.value.meta.nodeSnapshot.prop.value = cloned_trace[i].value;
				console.log(new_event.value.meta.deltas);
				var deltas = new_event.value.meta.deltas;
				for (var j = 0; j<deltas.length; j++){
					var delta = deltas[j];
					delta.changed.prop.value = cloned_trace[i].value;
				}
				prop_corrections[new_event.value.meta.nodeSnapshot.prop.xpath] = {"prop": "value", "value": cloned_trace[i].value};
				cloned_trace = cloned_trace.slice(0,i).concat([new_event]).concat(cloned_trace.slice(i+1,cloned_trace.length));
			}
		}
		var filtered_trace = _.filter(cloned_trace, function(obj){return obj["type"] === "dom";});
		console.log("cloned_trace", filtered_trace);
		for (var i = 0; i< filtered_trace.length; i++){
			console.log(filtered_trace[i].value.data.type);
			console.log(filtered_trace[i].value.meta.deltas);
			console.log("****************************");
		}
		return cloned_trace;
	}
}
