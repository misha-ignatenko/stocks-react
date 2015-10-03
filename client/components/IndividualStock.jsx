IndividualStock = React.createClass({
    getInitialState: function()
    {
        return ({
            individualStockStartDate: moment().format("YYYY-MM-DD"),
            individualStockEndDate: moment().format("YYYY-MM-DD")
        });
    },
    handleDatepickerChange: function(e) {
        let _set = {};
        _set[e.target.getAttribute("data-tag")] = e.target.value;
        this.setState(_set);
    },

    render: function() {

        return (
            <div>
                start date:
                <input type="date" value={this.state.individualStockStartDate} data-tag="individualStockStartDate" onChange={this.handleDatepickerChange}/>
                end date:
                <input type="date" value={this.state.individualStockEndDate} data-tag="individualStockEndDate" onChange={this.handleDatepickerChange}/>
            </div>
        )
    }
})