import React, { Component } from 'react';

export default class AccountsUIWrapper extends Component {
    componentDidMount() {
        this.view = Blaze.render(Template.loginButtons,
            this.refs.container);
    }
    componentWillUnmount() {
        // Clean up Blaze view
        Blaze.remove(this.view);
    }
    render() {
        // Just render a placeholder container that will be filled in
        return <span ref="container" />;
    }
}