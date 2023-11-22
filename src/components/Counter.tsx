import { Routes, Route, BrowserRouter, Link } from 'react-router-dom';
import { useState } from 'react';



export default function Counter() {

    let [foo, setFoo] = useState(0)     //make foo a stateful variable
    function incrementClick() {            //increment foo each time the function is called
        setFoo(foo + 1)
    }
    function decrementClick() {            //decrement foo each time the function is called
        setFoo(foo - 1)
    }

    return (
        <div>
            <button onClick={incrementClick}>                      
                The Tomes, the Library, the Magic {foo} . Increment
            </button>

            <button onClick={decrementClick}>                      
                Camping with Steve {foo} . Decrement
            </button>

        </div>
    );
}
