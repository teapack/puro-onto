import jsonData from './rules.json';
import RdfController from './RdfController.js';

import $ from 'jquery';
import { throwStatement, logicalExpression, tsThisType } from '@babel/types';
import { isFulfilled, async, allSettled } from 'q';


export default class RuleController {


    constructor() {
        this.rulesJson = JSON.parse(JSON.stringify(jsonData));      
        this.rdfController = new RdfController(); 
        var queryTreePromise = this.rdfController.getFullPath();
        queryTreePromise.then(function(results) {
            this.queryTree = results;   
            console.log(results);        
        }.bind(this));

        //tree bude tady 
        this.ontoModel = [];
        this.index = 0;
        this.ruleIndex = 0;
        this.typeSelection = true;
        this.selectedEl = null;
        this.selectedType =null;
        this.lastSelectedType = null;
    }
    getButtons = () => {
        var rulesJson = this.rulesJson;
       
       
        var element = this.queryTree[this.index];
        var stop = false;    
        if ('child' in element) {
            if (element.child.length === 0 && element.connect.length === 0 && element.connectFrom.length === 0)
            {
               
                this.index ++; 
                element = this.queryTree[this.index];
              
            }
            else 
            {
                stop = true;
            }
        } 


        var label  = element.label.value; 
        var puroType = element.type.value.split('#')[1];
        var relation = "";
        var father = ""; 
        var fromOnto = "";
        var linkedTo = 0;
        var question = "";

        
        if ('fatherTypeRelation' in element) {
           relation = this.delUri(element.fatherTypeRelation[0]);
        }
        

        fromOnto = this.getFatherOntoType(element);
        
        if ('connect' in element && element.connect !== null) {
            linkedTo = element.connect.length;
        }
        // víc tatku pole
        if (puroType === "BType" && this.delUri(element.fatherType[0]) !== "BType") {
           question =  rulesJson.questions[0].replace("VAL",label);
        }
        else
        {
      
          // Zeptej se zda reprezentuje nějaký datatyp
          question =  rulesJson.questions[1].replace("VAL",label);
        } 
        
        // ještě dopň vztahy
        //  this.ontoModel.push({uri: element.uri.value, label: label, from: father, ontoType: "", puroType: puroType});
        var result = []; 
        for (let i in rulesJson.rules) {
           // rulesJson.rules[i].puroType ===  puroType && 
            if (fromOnto.includes(rulesJson.rules[i].fromOnto) &&
                rulesJson.rules[i].relation === relation &&
                rulesJson.rules[i].linkedTo <= linkedTo  
                ) {      
                // ošetřit když se pravidlo nenajde
                if (rulesJson.rules[i].offer === 0)
                {
                    result = rulesJson.classes.map(function (ruleEl) {
                        return {"name": ruleEl, "uri":null};
                      });
                    return  {"buttons": result,"title": question};
                } 

                else
                {
                   // OPRAV NAMAPUJ!!!!!!!!!!!!!!!!!!!!!!!!
                   for(let val of rulesJson.rules[i].offer) 
                   { 
                       result.push({"name":rulesJson.classes[val], "uri":null}); 
                   }
                   return {"buttons": result, "title": question};
                }
                
            }
        }
    }
    
    // je třeba checkovat ontoModel 
    ruleSelection =  (rule, element, uri) => 
    {
        
        if ("connect" in rule[this.ruleIndex]) 
        {
           
            //pokud type selection zeptej se na typ konkrétního elementu!
            // může mít dva tatky projít cyklem 
            //podívej se jestli už není určen
            if(rule[this.ruleIndex].connect.includes(this.ontoModel[this.index-2].ontoType.toLowerCase()) && this.typeSelection === false && this.selectedEl===null
            && 'father' in element )
            {
                return false; 
            }
            else
            {
                // najdi nebo nabídni typy
                // podívej se jesltli už nebyli zvoleni (asi ne) -> dodělej později
                // možná father type 
                

                if ((this.ruleIndex > 0 && "findRelation" in rule[this.ruleIndex - 1]) || uri )
                {
               
                    let result = rule[this.ruleIndex].connect.map(function (ruleClass) {
                        return {"name": ruleClass, "uri":null};
                    });
                    return Promise.resolve({"buttons": result, "title": rule[this.ruleIndex].question});
                }
                else
                {
            
                    //cyklus!!!!!!!!!!!!!!!!!!! child > 1
                    let i = this.ruleIndex;
                    let result = [{"name": this.delUri(element.child.value), "uri":element.child.value}];  
                    // ještě se to sem musí vrátit aby se určil typ; 
                    this.ruleIndex --;
                    return Promise.resolve({"buttons": result, "title": rule[i].question});
                }



            }
        } 
        // zkontroluj v případě dvojic
        else if ("findRelation" in rule[this.ruleIndex])
        {
           
            if (element.connect.length > 0 || element.connectFrom.length > 0) {
                //podívej se pres relator na objekt ci subtype
                //podivej se na okolní 
                var endBTypes = [];
                var connection = element.connect.concat(element.connectFrom);
                for (let relation of connection)
                {
                   endBTypes.push(this.rdfController.getRelatorBtype(relation));
                }
                return Promise.all(endBTypes).then(function(results) {

                   
                    var buttons = [];    
                    for (var el of results) {
                
                      if (el[0].father.value === null)
                      {
                        buttons.push({"name":el[0].elementLabel.value, "uri":el[0].element.value, "relName":el[0].relationName});
                      }
                      else
                      {     
                        buttons.push({"name":el[0].fatherLabel.value, "uri":el[0].father.value,"relName":el[0].relationName});
                      }            
                    }
                    //podívej jestli už nemá určený typ.. pokud ano krok +2 
                    return ({"buttons": buttons, "title":rule[this.ruleIndex].question});
                }.bind(this));
                
            }
            else{
                return false; 
            }
        }
        else if ("create" in rule[this.ruleIndex])
        { 
            
            var returnVal = [{"name": "yes", "uri": rule[this.ruleIndex].create}, {"name": "no", "uri": null}]
            return Promise.resolve({"buttons": returnVal, "title":rule[this.ruleIndex.question]}); 
        }
        else if ("relation" in rule[this.ruleIndex])
        {

        }



    }

    nextElement = async (selectedType, selectedUri, relName) =>
    {

        
        // možná jde vylepšit líp
        var rule; 
        // test!!!!!!!!!
        
        if (this.selectedEl === null)
        {
            var element = this.getNextElement();
        }
        else 
        {
            for (let node of this.queryTree)
            {
                if(node.uri.value === this.selectedEl)
                {
                    element = node;
                    break;
                }
            }
        }
        
        //tohle jde udělat určitě líp
        if(this.typeSelection === true)
        {
            // tohle je hovno 
            this.addToOntoModel(selectedType); 
            this.typeSelection = false; 
            this.index ++;

        }   
        
        
        if (this.selectedType === null)
        {
            
            rule = this.rulesJson[selectedType.toLowerCase()];
        }
        else
        {
            rule = this.rulesJson[this.selectedType.toLowerCase()];
            
        }

        if(selectedType === "yes" || selectedType === "no")
        {
            if(selectedType === "yes")
            {
                
                this.addToOntoModel(selectedUri, "new", rule);
                selectedUri = null; 
            }
            else
            {
                this.ruleIndex ++;
            }

        }

    

        // tohle je mrdla přidej jako elemen 
        if(selectedUri)
        {
            this.selectedEl = selectedUri;
        }
        else if (this.selectedEl && this.ruleIndex !== rule.length)
        {

            this.addToOntoModel(selectedType, this.selectedEl);
            this.lastSelectedType = selectedType
        }



        // == 2 jen pro devbug
        if ((this.index > 1 && this.ruleIndex < rule.length) || (this.selectedEl !== null && this.ruleIndex === rule.length)) {  
           
            if (this.ruleIndex === 0 && !selectedUri) {
                this.selectedType = selectedType;
            }
            
            if ((this.ruleIndex === rule.length && this.selectedEl !== null))
            {
                this.ruleIndex = 0;            
            }

 
            
            var ruleResult = this.ruleSelection(rule,element, selectedUri);
            //what type is ddc topic 
            //možná by se hodilo posílat selecte
            console.log("je");
            console.log(ruleResult);
            while (ruleResult === false) {
                this.ruleIndex ++;
                ruleResult = this.ruleSelection(rule,element, selectedUri);    
                 
            }
            
    
            return new Promise(resolve => {ruleResult.then(function(results) {
                this.ruleIndex ++;
                resolve(results);
            }.bind(this));
            });

            // return formate rule result
        }
        else {
            
            this.ruleIndex = 0;
            this.selectedType = null;
        
        }
        
       
        if (this.ruleIndex === 0)
        {
        //smazat v return buttons
        this.typeSelection = true;
       
        return new Promise(resolve => {
        // do stromu doplňuje info o relation
            resolve(this.getButtons()); 
        }); 
        }



    }

    addToOntoModel = (selected, elementUri, rule) => 
    {
        
        var element; 

        if(elementUri)
        {
        
            if (elementUri === "new")
            {
                //zapiš to onto Modelu a vypni 
              
                let from = rule[this.ruleIndex - 1].from ;
                let to = rule[this.ruleIndex - 1].to ;

                from = this.ontoModel[this.ontoModel.length + from].uri;
                to  = this.ontoModel[this.ontoModel.length + to].uri;
                this.ontoModel.push({uri: "", label: "NAME", from: from, to: to, ontoType: selected, puroType: null});

                return true; 
            }
            else
            {
                for (let node of this.queryTree)
                {
                    if(node.uri.value === elementUri)
                    {
                        element = node;
                        break; 
                    }
                }
            }
           
        }
        else{
            element = this.queryTree[this.index];
        }

        var label  = element.label.value; 
        var puroType = element.type.value.split('#')[1];
        var relation = "";
        var father = []; 
        var fromOnto = "";
        var linkedTo = 0;
        var question = "";
        if ('relation' in element) {
           relation = element.relation.value.split('#')[1];
        }
        // problém v případě dvou otců.. 
       
        if ('father' in element) {
            father = element.father[0];
        }
        
        if ('connect' in element && element.connect !== [] && element.connect !== null) {
            linkedTo = element.connect.length;
        }

        //bacha na index možná bude jinak
        fromOnto = this.getFatherOntoType(element);
        
        // ještě dopň vztahy
        this.ontoModel.push({uri: element.uri.value, label: label, from: father, ontoType: selected, puroType: puroType});
        console.log(this.ontoModel);
        return true; 
    }

    delUri = (uri) => 
    {
        if (typeof uri === 'string')
        {
            return uri.split('#')[1];
        }
        else
        {
            return "";
        }
        
    }

    l = (m2) =>
    {
        console.log("CECKKKKKKKKKKKKKKKKKKKKK");
        console.log(m2);
    } 

    getNextElement = () =>
    {
        if (this.isElementUseless(this.queryTree[this.index]))
        {
         this.index ++; 
        }
        for (let index = 0; index < this.ontoModel.length; index ++) 
        {
            if (this.ontoModel[index].uri === this.queryTree[this.index].uri.value)
            {
               
                this.index ++;
                if (this.isElementUseless(this.queryTree[this.index]))
                {
                 this.index ++; 
                }
                index = 0;  
            }
        }
        return this.queryTree[this.index];

    }

    isElementUseless = (element) =>
    {
        if ('child' in element) {
            if (element.child.length === 0 && element.connect.length === 0 && element.connectFrom.length === 0)
            {       
                return true; 
            }
        } 
        return false; 
    }

    getFatherOntoType = (element) => 
    {

        let result = []; 
        if ('father' in element)
        {
            for (let node of this.ontoModel)
            {
                if(element.father.includes(node.uri))
                {
                    result.push(node.ontoType);
                }
            }
        }

        if(result.length === 0)
        {
            result = [""];
        }
        return result;
    }
        
}



