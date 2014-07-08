function ParameterizedTrace(trace){
    var trace = trace;
    
    /* xpath parameterization */

    this.parameterizeXpath = function(parameter_name, original_value) {
        for (var i = 0; i< trace.length; i++){
			if (trace[i].type !== "dom"){ continue;}
			var xpath = trace[i].value.data.target.xpath;
			if (xpath === original_value){
				trace[i].value.data.target.xpath = {"name": parameter_name, "value": null};
				console.log("xpath", trace[i].value.data.target.xpath);
			}
		}
    }

    this.useXpath = function(parameter_name, value) {
        for (var i = 0; i< trace.length; i++){
			if (trace[i].type !== "dom"){ continue;}
			var xpath = trace[i].value.data.target.xpath;
			console.log(xpath.hasOwnProperty("name"), xpath["name"], parameter_name);
			console.log("xpath", trace[i].value.data.target.xpath);
			if (xpath["name"] === parameter_name){
				console.log("replacing "+parameter_name+" with "+value);
				trace[i].value.data.target.xpath = {"name": parameter_name, "value": value};
			}
		}
    }
    
    /* user-typed string parameterization */
    
    this.parameterizeTypedString = function(parameter_name, original_string){
		
	}
	
	this.useTypedString = function(parameter_name, string){
		
	}
    
    /* using current arguments, create a standard, replayable trace */
    
    this.standardTrace = function(){
		var cloned_trace = clone(trace);
        for (var i = 0; i< cloned_trace.length; i++){
			if (cloned_trace[i].type !== "dom"){ continue;}
			var xpath = cloned_trace[i].value.data.target.xpath;
			if (xpath["name"]){
				cloned_trace[i].value.data.target.xpath = xpath["value"];
			}
		}
		return cloned_trace;
	}
}
