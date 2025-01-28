import React from 'react';
import ReactDOM from 'react-dom';
import { Model } from './model/model';

const App = () => (
    <React.Fragment>
        <span>Hello world</span>
        <Model />
    </React.Fragment>
);

ReactDOM.render(
    <App />,
    document.getElementById('root')
);
