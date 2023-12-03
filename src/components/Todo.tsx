import { useState, useEffect } from 'react';
import supabase from '../utils/supabaseClient';
import '../App.css';
import ViewTodoList from './ViewTodoList';
import RenderCreateButton from './RenderCreateButton';
import RenderSpecificTodo from './RenderSpecificTodo';


export default function App() {

    let [isVisible, setIsVisible] = useState(false)

    const handleButtonClick = () => {
        setIsVisible(!isVisible)    //change isVisible's value
    }


    type TodoType = {
        id: number;
        name: string;
        urgent?: boolean;
        important?: boolean;
        parent_id?: number;
    };


    const [todos, setTodos] = useState<TodoType[]>([]);

    const fetchTodos = async () => {
        let { data: todos, error } = await supabase
            .from('todos')
            .select('*');

        if (error) console.log('error', error);
        else setTodos(todos || []);
    };

    useEffect(() => {
        fetchTodos();
    }, []);

    let [currentTodo, setCurrentTodo] = useState(todos[3])      //arbitrary inital value to make compiler happy

                                //uses isVisible and currentTodo useState variables
    function SingleTodo() {
        let result = <> </>
        let todoIsVisible = isVisible
        if (todoIsVisible) {
            result = <div>
                <button onClick={handleButtonClick}> Back</button>
                <button onClick={handleButtonClick}> View Family Tree</button>  {/* need to complete */}
                <button onClick={handleButtonClick}> Edit</button>  {/* need to complete */}
                <button onClick={handleButtonClick}> Delete</button>  {/* need to complete */}
                <h3>Selected Todo Item:</h3>
                <table className='TodoTable' >
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Urgent</th>
                            <th>Important</th>
                            <th>Parent ID</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>{currentTodo.name}</td>
                            <td>{JSON.stringify(currentTodo.urgent)}</td>
                            <td>{JSON.stringify(currentTodo.important)}</td>
                            <td>{JSON.stringify(currentTodo.parent_id)}</td>
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
        let result =  <RenderSpecificTodo handleButtonClick={handleButtonClick} isVisible ={isVisible} currentTodo={currentTodo}/>
        if (isVisible) {
            result = <RenderSpecificTodo handleButtonClick={handleButtonClick} isVisible ={isVisible} currentTodo={currentTodo}/>
        } else {
            result = <div>
                <RenderCreateButton />
                <ViewTodoList isVisible={isVisible} setIsVisible={setIsVisible}
                    handleButtonClick={handleButtonClick} todos={todos} setCurrentTodo={setCurrentTodo} />
            </div>
        }

        return (
            <div>
                {result}
            </div>
        )
    }

    const getTodoNameById = (id: number): string => {
        const todo = todos.find(todo => todo.id === id);
        return todo ? todo.name : 'Todo not found';
      };
    
      const getParentIdById = (id: number): number | undefined => {
        const todo = todos.find(todo => todo.id === id);
        return todo ? todo.parent_id : undefined;
      };
      
      const getTodoById = (id: number): TodoType | undefined => {
        return todos.find(todo => todo.id === id);
      };
      
    
      const getTodoParentsList = (initialTodo: TodoType) => {
        let currentTodo: TodoType | undefined = initialTodo;
        let result: number[] = [];
      
        while (currentTodo) {
          result.push(currentTodo.id);
          const parentId = getParentIdById(currentTodo.id);
      
          if (parentId) {
            // Convert parentId to a number if it's a string
            const numericParentId = typeof parentId === 'string' ? parseInt(parentId, 10) : parentId;
            currentTodo = todos.find(todo => todo.id === numericParentId);
          } else {
            currentTodo = undefined; // Stop the loop if there is no parent
          }
        }
      
        return result;
      };
      
    
    
      const getTodoParentsStringList = (todoId:number) => {
        const initTodo = getTodoById(todoId);
        let result:string[] = []
      
        if (initTodo) {
          let a = getTodoParentsList(initTodo)
          
      
          for (let i = 0; i < a.length; i++) {
            result.push(getTodoNameById(a[i]))
          };
        } else {
          console.log('Todo not found');
        }
        console.log(result)
      };


    return (
        <div className="App-header">
            <IsVisibleController />
            <button onClick={() => {getTodoParentsStringList(88)}}> Lomo</button>
        </div>
    );
}
