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
				}
				else if (event_data["type"] === data_carrier_type){
					curr_string += event_data.data;
				}
				else if (event_data["type"] === last_event_type){
					started_char = false;
				}
				console.log(curr_string);
			}
			else{
				//no more entries into this string, have a non-key event
				processString(parameter_name, original_string, curr_string, char_indexes);
				curr_string_chars = [];
			}
		}
	}
	
	function processString(parameter_name, original_string, string, char_indexes){
		original_string = original_string.toLowerCase();
		string = string.toLowerCase();
		var orig_i = string.indexOf(original_string);
		if (orig_i > -1){
			//we've found the target string in the typed text, must param
			var one_key_start_index = char_indexes[orig_i];
			var one_key_end_index = char_indexes[orig_i+1];
			//the trace events that we'll use to create events later
			var one_key_trace = trace.slice(one_key_start_index, one_key_end_index);
			//now make our param event
			var param_event = {"type": "string_parameterize", "parameter_name": parameter_name, "one_key_events": one_key_trace};
			//now remove the unnecessary events, replace with our param event
			var post_char_index = char_indexes[orig_i+original_string.length - 1] + one_key_trace.length;
			trace = trace.slice(0,one_key_start_index)+[param_event]+trace.slice(post_char_index, trace.length);
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
        for (var i = 0; i< cloned_trace.length; i++){
			if (cloned_trace[i].type === "dom"){
				var xpath = cloned_trace[i].value.data.target.xpath;
				if (xpath["name"]){
					cloned_trace[i].value.data.target.xpath = xpath["value"];
				}
			}
			else if (cloned_trace[i].type === "string_parameterize"){
				var new_events = [];
				for (var j = 0; j< cloned_trace[i].value.length; j++){
					var char = cloned_trace[i].value[j];
					for (var k = 0; k < cloned_trace[i].one_key_events.length; k++){
						var next_event = clone(cloned_trace[i].one_key_events[k]);
						if (next_event.type === data_carrier_type){
							next_event.value.data.data = char;
						}
						new_events.push(next_event);
					}
				}
				cloned_trace = cloned_trace.slice(0,i)+new_events+cloned_trace.slice(i+1,cloned_trace.length);
			}
		}
		console.log("cloned_trace", _.filter(cloned_trace, function(obj){return obj["type"] === "dom";}));
		return cloned_trace;
	}
}
