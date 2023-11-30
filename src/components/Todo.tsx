import { useState } from 'react';
import '../App.css';
import ViewTodoList from './ViewTodoList';
import RenderCreateButton from './RenderCreateButton'
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

    let mockTodoObject: TodoType = {
        id: 1337,
        name: "goku",
    }

    let handleTodoClick = () => {
        console.log("Kvloth the bloodless")
    }

    function SingleTodo() {
        let result = <> </>
        let todoIsVisible = !isVisible
        if (todoIsVisible) {
            result = <div>
            <h3> Todo Item you clicked on</h3>
            <table className='TodoTable' onClick ={handleButtonClick} >
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


    return (
        <div className="App-header">
            <RenderCreateButton />
            <RenderSpecificTodo isVisible={isVisible} setIsVisible={setIsVisible} handleButtonClick={handleButtonClick} />
            <ViewTodoList />
            <SingleTodo />
        </div>
    );
}
