import { useState } from 'react';
import '../App.css';
import ViewTodoList from './ViewTodoList';
import RenderCreateButton from './RenderCreateButton';
import RenderSpecificTodo from './RenderSpecificTodo';


export default function App() {

    let [isVisible, setIsVisible] = useState(false)

    const handleButtonClick = () => {
        setIsVisible(!isVisible)    //change isVisible's value
    }

    //Below is code to render a component the mockTodo thing in the same way I render ViewTodoList

    type TodoType = {
        id: number;
        name: string;
        urgent?: boolean;
        important?: boolean;
        parent_id?: number;
    };



    function SingleTodo() {
        let result = <> </>
        let todoIsVisible = isVisible
        if (todoIsVisible) {            //if isVisible, render the table
            result = <div>
                <h3> Todo Item you clicked on</h3>
                <table className='TodoTable' onClick={handleButtonClick} >
                    <tbody>
                        <tr>
                            <th>Name</th>
                            <th>Urgent</th>
                            <th>Important</th>
                            <th>Parent ID</th>
                        </tr>

                    </tbody>
                </table>
            </div>
        }
        else {
            result = <> </>
        }

        return (
            result
        )
    };

    const IsVisibleController = () => {
        let result = <SingleTodo />
        if (isVisible) {
            result = <SingleTodo />
        } else {
            result = <div>
                <RenderCreateButton />
                <ViewTodoList isVisible={isVisible} setIsVisible={setIsVisible} handleButtonClick={handleButtonClick}/>
            </div>
        }

        return (
            <div>
                {result}
            </div>
        )
    }


    return (
        <div className="App-header">
            <IsVisibleController />
        </div>
    );
}
