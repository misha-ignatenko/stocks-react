import React, { Component } from 'react';

export default class ExistingPortfolioImport extends Component {

    constructor(props) {
        super(props);

        this.state = {
            equalWeight: true,
            splitIntoCells: false,
            textAreaValue: "",
            cellValues: []
        };

        this.changeWeightConfig = this.changeWeightConfig.bind(this);
    }

    changeWeightConfig() {
        this.setState({
            equalWeight: !this.state.equalWeight
        });
    }

    handleIndividualCellChange() {

    }

    renderCells() {
        var _firstObj = this.state.cellValues[0];
        var _keys = [];
        for (var key in _firstObj) {
            _keys.push(key);
        }

        return (
            <div>


                {_keys.map((key) => {
                    var _keyyy = key.replace(/ /g,"_");
                    return <div className="col-md-2" key={_keyyy}>
                        <span key={_keyyy}>{key}</span>
                    </div>
                })}
                <br/>


                {this.state.cellValues.map((cellValues, index) => {
                    var keys = _keys;
                    return (<div className="row" key={index}>{_keys.map((keyy) => {
                        const val = cellValues[keyy];
                        const _key = index.toString() + "_" + keyy;

                        return <div className="col-md-2" key={_key}><input className="simpleInput" id={_key} key={_key} value={val} onChange={this.handleIndividualCellChange}/></div>;
                    })}<br/></div>)
                })}
            </div>
        );
    }

    convertToCells(event) {
        //parse stuff here and set splitIntoCells to true of all items contain the keys from 1st object
        var _textAreaNewValue = event.target.value;
        var _allLines = _textAreaNewValue.split("\n");
        var _splitByTabsAndNewLines = [];
        _allLines.forEach(function(line) {
            var _splitLine = line.split("\t");
            _splitByTabsAndNewLines.push(_splitLine);
        });
        var _parsed = [];
        if (_splitByTabsAndNewLines.length > 0) {
            var _keyz = _splitByTabsAndNewLines[0];
            //remove keys, which is the first item in this array
            _splitByTabsAndNewLines.shift();
            _splitByTabsAndNewLines.forEach(function(dataArr){
                var _everyItemInDataArrIsNonBlank = true;
                dataArr.forEach(function(val) {
                    if (val === "") {
                        _everyItemInDataArrIsNonBlank = false;
                    }
                });
                if (_everyItemInDataArrIsNonBlank) {
                    var _row = {};
                    _keyz.forEach(function(key, index) {
                        _row[key] = dataArr[index];
                    });
                    _parsed.push(_row);
                }
            });
        }



        //var _importObjects = '[' + _textAreaNewValue.substring(0,_textAreaNewValue.length-1) + ']';
        //var _parsed = JSON.parse(_importObjects);
        if (_parsed.length > 0) {
            var _firstObj = _parsed[0];
            var _keys = [];
            for (var key in _firstObj) {
                _keys.push(key);
            }
            //make sure that every object in parsed contains these fields
            // if not, then alert the user
            var _problems = [];
            _parsed.forEach(function(obj, index) {
                _keys.forEach(function(key) {
                    if (!obj[key]) {
                        _problems.push({
                            index: index,
                            key: key
                        });
                    }
                });
            });
            if (_problems.length > 0) {
                console.log("problems: ", _problems);
            } else {
                this.setState({
                    splitIntoCells: true,
                    cellValues: _parsed
                });
            }
        }

        this.setState({
            textAreaValue: _textAreaNewValue
        })
    }

    clearCells() {
        this.setState({
            textAreaValue: "",
            splitIntoCells: false,
            cellValues: []
        });
    }

    removeWarningsAndResults() {
        $(".bootstrap-growl").remove();
    }

    componentWillUnmount() {
        this.removeWarningsAndResults();
    }

    verifyAndImport() {

        this.removeWarningsAndResults();

        var _parsed = this.state.cellValues;
        this.clearCells();

        var _data = {
            portfolioItems: _parsed,
            portfolioName: this.refs.portfolioName.value,
            dateString: this.refs.dateString.value,
            equalWeight: this.state.equalWeight
        };

        Meteor.call("importPortfolioItems", _data, function(error, result) {

            if (error) {
                $.bootstrapGrowl(error.error, {
                    type: "danger",
                    align: "center",
                    width: 400,
                    delay: 10000000,
                    // offset: {from: "top", amount: 200},
                });
            } else if (result) {
                $.bootstrapGrowl(
                    "imported stats<br>new: " + result.numberImported,
                    {
                        type: "success",
                        align: "center",
                        width: 250,
                        delay: 10000000
                    });
            }
        });
    }

   render() {
       let _b = "btn btn-md btn-light";
       let _ab = "btn btn-md btn-light active";

       return (<div className="container">
           <br/>
           Portfolio name: <input ref="portfolioName" /><br/>
           Date: <input ref="dateString" /><br/>
           Weight: <div className="btn-group" role="group" aria-label="...">
               <button type="button" className={this.state.equalWeight ? _ab : _b} onClick={this.changeWeightConfig}>Equal</button>
               <button type="button" className={!this.state.equalWeight ? _ab : _b} onClick={this.changeWeightConfig}>Custom</button>
           </div>

           {!this.state.splitIntoCells ? <div className="textAreaEntryDiv">
                            <textarea rows="20" cols="100"
                                      value={this.state.textAreaValue}
                                      onChange={this.convertToCells}></textarea>
           </div> : <div>
               {this.renderCells()}
               <br/><br/>
               <button className="btn btn-lg btn-light"
                   onClick={this.verifyAndImport}>IMPORT</button>
               <br/><br/><br/><br/>
           </div> }

       </div>);
   }
}