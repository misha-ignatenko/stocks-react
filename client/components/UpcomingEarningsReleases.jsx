UpcomingEarningsReleases = React.createClass({

    mixins: [ReactMeteorData],

    getInitialState() {
        return {
            startEarningsReleaseDateInteger: parseInt(moment(new Date().toISOString()).format("YYYYMMDD")),
            endEarningsReleaseDateInteger: parseInt(moment(new Date().toISOString()).add(10, 'days').format("YYYYMMDD")),
            earningsReleaseIndex: 0
        }
    },

    getMeteorData() {


        //check if EXP_RPT_DATE_QR1 or EXP_RPT_DATE_QR2 exist inside earningreleases collection
        //TODO: need code for EXP_RPT_DATE_QR3 and EXP_RPT_DATE_QR4

        //generate 2 numbers based on todays
        var _allEarningsReleases = EarningsReleases.find({$or: [
            {fieldNames: "EXP_RPT_DATE_QR1"},
            {fieldNames: "EXP_RPT_DATE_QR4"},
            {fieldNames: "EXP_RPT_DATE_QR3"},
            {fieldNames: "EXP_RPT_DATE_QR4"}
        ]}).fetch();

        //now get indices of those corresponding qr1, 2 or whatever and see if item at that index inside earningsData array is between the requested start and end date
        var _upcomingEarningsReleases = [];
        _allEarningsReleases.forEach(function(release) {
            var _addToUpcomingList = false;
            for (var i=1; i<=4; i++) {
                var _fieldName = "EXP_RPT_DATE_QR" + i;
                if (_.indexOf(release.fieldNames, _fieldName) > -1 &&
                    release.earningsData[_.indexOf(release.fieldNames, _fieldName)] >= parseInt(moment(new Date().toISOString()).format("YYYYMMDD")) &&
                    release.earningsData[_.indexOf(release.fieldNames, _fieldName)] <= parseInt(moment(new Date().toISOString()).add(10, 'days').format("YYYYMMDD"))
                ) {
                    _addToUpcomingList = true;
                    break;
                }
            }

            if (_addToUpcomingList) {
                _upcomingEarningsReleases.push(release);
            }
        });

        return {
            currentUser: Meteor.user(),
            upcomingEarningsReleases: _upcomingEarningsReleases
        }
    },
    renderUpcomingEarningsReleases() {
        return this.data.upcomingEarningsReleases.map((release) => {
            return <button key={release.symbol}>{release.symbol}</button>
        })
    },
    previousEarningsRelease() {
        let _previousState = this.state.earningsReleaseIndex;
        let _newState = _previousState - 1 >= 0 ? _previousState - 1 : this.data.upcomingEarningsReleases.length - 1;
        this.setState({
            earningsReleaseIndex: _newState
        });
    },
    nextEarningsRelease() {
        let _previousState = this.state.earningsReleaseIndex;
        let _newState = _previousState + 1 <= this.data.upcomingEarningsReleases.length - 1 ? _previousState + 1 : 0;
        this.setState({
            earningsReleaseIndex: _newState
        });
    },

    render() {
        let _symbol = this.data.upcomingEarningsReleases &&
            this.data.upcomingEarningsReleases.length > 0 &&
            this.state.earningsReleaseIndex.toString() &&
            this.state.earningsReleaseIndex + 1 <= this.data.upcomingEarningsReleases.length ?
            this.data.upcomingEarningsReleases[this.state.earningsReleaseIndex].symbol : "undefined";

        return (
            <div className="container">
                { this.data.currentUser ? (
                    this.data.currentUser.registered ? (
                        <div>
                            {this.state.startEarningsReleaseDateInteger}
                            <br/>
                            {this.state.endEarningsReleaseDateInteger}
                            <br/>
                            <button onClick={this.previousEarningsRelease}>previous</button>
                            <button onClick={this.nextEarningsRelease}>next</button>
                            <br/>
                            { this.renderUpcomingEarningsReleases() }
                            <br/>
                            <br/>
                            <UpcomingEarningsRelease symbol={_symbol} />
                            <br/>
                            upcoming earnings releases
                        </div>
                    ) : null
                ) : null}
            </div>
        );
    }
});