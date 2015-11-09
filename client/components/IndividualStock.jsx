IndividualStock = React.createClass({
    getInitialState: function()
    {
        return ({
            individualStockStartDate: moment().format("YYYY-MM-DD"),
            individualStockEndDate: moment().format("YYYY-MM-DD")
        });
    },
    componentDidMount: function() {
        let _datepickerOptions = {
            autoclose: true,
            todayHighlight: true
        };
        $('#individualStockStartDate').datepicker(_datepickerOptions);
        $('#individualStockEndDate').datepicker(_datepickerOptions);
        var _that = this;

        $('.datepickerInput').on('change', function() {
            let _newVal = $(this).val();
            let _momentDate = moment(new Date(_newVal).toISOString()).format("YYYY-MM-DD");
            let _id = $(this).attr('id');
            let _set = {};
            _set[_id] = _momentDate;
            _that.setState(_set);
        });
    },

    render: function() {
        return (
            <div className="container">
                start date:
                <input className="datepickerInput" id="individualStockStartDate" />
                end date:
                <input className="datepickerInput" id="individualStockEndDate" />
                <br/>
                <br/>
                stats for this stock based on these dates will be here:
                <br/>
                {this.state.individualStockStartDate}
                <br/>
                {this.state.individualStockEndDate}
            </div>
        )
    }
})