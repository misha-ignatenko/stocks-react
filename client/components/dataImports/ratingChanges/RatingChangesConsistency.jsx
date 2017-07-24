RatingChangesConsistency = React.createClass({
    mixins: [ReactMeteorData],

    getInitialState() {
        return {
            selectedSymbol: undefined,
            showFirms: true,
            selectedFirmId: undefined
        };
    },

    getMeteorData() {
        var _data = {
            currentUser: Meteor.user()
        };
        if (this.state.selectedSymbol && Meteor.subscribe("allRatingChangesForSymbol", this.state.selectedSymbol).ready() && Meteor.subscribe("ratingScales").ready()) {
            _data.allRatingChanges = RatingChanges.find({symbol: this.state.selectedSymbol}, {sort: {dateString: 1}}).fetch();
            _data.uniqFirmIds = _.uniq(_.pluck(_data.allRatingChanges, "researchFirmId"));
            _data.ratingScales = RatingScales.find().fetch();
            var _firmId = this.state.selectedFirmId;
            if (_firmId) {
                _data.rChForFirm = _.filter(_data.allRatingChanges, function (rCh) { return rCh.researchFirmId === _firmId; })
            }
        }

        return _data;
    },

    showRes() {
        var _trimmed = this.refs.sym.value.trim();
        if (_trimmed.length > 0) {
            this.setState({
                selectedFirmId: undefined,
                showFirms: true,
                selectedSymbol: _trimmed
            })
            this.refs.sym.value = "";
        }
    },
    setFirm(event) {
        this.setState({
            showFirms: false,
            selectedFirmId: event.target.value
        })
    },
    removeDup(event) {
        Meteor.call("removeDupRatingChange", event.target.value, function (err, res) {
            console.log(err);
        });
    },
    renderRatingChangeHistory() {
        var _rCh = this.data.rChForFirm;
        var _rSc = this.data.ratingScales;
        var _displayData = [];
        if (_rCh) {
            _.each(_rCh, function (rc, index) {
                var _obj = {
                    _id: rc._id,
                    date: rc.dateString,
                    old: _.find(_rSc, function (rs) {return rs._id === rc.oldRatingId}).universalScaleValue,
                    new: _.find(_rSc, function (rs) {return rs._id === rc.newRatingId}).universalScaleValue
                };

                // check for problems
                if (index > 0) {
                    var _previousOld = _displayData[index - 1].old;
                    var _previousNew = _displayData[index - 1].new;
                    if (_obj.new === _previousNew && _obj.old === _previousOld) {
                        console.log("this is a duplicate: ", _obj.date);
                        _obj.duplicate = true;
                    } else if (_previousNew !== _obj.old) {
                        console.log("current old does not match previous new: ", _obj.date);
                        _obj.oldMismatch = true;
                    }
                }

                _displayData.push(_obj);
            })

            console.log(_displayData);
        }
        return <div>
            <h3>Rating Change History</h3>
            {_rCh ? <p>Symbol: {this.state.selectedSymbol}. Firm: {this.state.selectedFirmId}. Number of rating changes: {_rCh.length}</p> : null}

            {_rCh ? <ul>
                        {_displayData.map((data) => {
                            return <li key={data._id}>
                                date: {data.date}<br/>
                                old: {data.old}<br/>
                                new: {data.new}&nbsp;&nbsp;&nbsp;
                                {data.duplicate ?
                                    <button className="btn btn-default btn-sm" value={data._id} onClick={this.removeDup}>remove dup</button> :
                                    null}
                                </li>
                        })}
                    </ul> : null}
        </div>
    },

    render() {

        return (
            <div className="container">
                { this.data.currentUser ? (<div className="ratingChangesConsistencyDiv">
                        <h1>Rating Changes Consistency</h1>
                        Symbol: <input ref="sym" /> <button className="btn btn-default" onClick={this.showRes}>Show Results</button>
                        {this.data.allRatingChanges ? <p>Total rating changes: {this.data.allRatingChanges.length}</p> : null}
                        {this.state.showFirms && this.data.uniqFirmIds ? <div>{this.data.uniqFirmIds.map((firmId) => {
                            return <button key={firmId} value={firmId} className="btn btn-default btn-sm" onClick={this.setFirm}>{firmId}</button>
                            })}</div> : null}
                        {this.renderRatingChangeHistory()}
                    </div>) : <p>Please log in.</p> }
            </div>
        );
    }
});