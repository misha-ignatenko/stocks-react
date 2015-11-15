App = React.createClass({
    componentDidMount: function() {
        //TODO: get rid of this when deployed.
        //Meteor.loginWithPassword("mignatenko", "mignatenko");
    },
    render() {
        return (
            <div>
                { this.props.children }
            </div>
        )
    }
})