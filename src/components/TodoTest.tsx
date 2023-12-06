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
            .from('todos_test')
            .select('*');

        if (error) console.log('error', error);
        else setTodos(todos || []);
    };

    useEffect(() => {
        fetchTodos();
    }, []);

    let [currentTodo, setCurrentTodo] = useState(todos[3])      //arbitrary inital value to make compiler happy


    const IsVisibleController = () => {
        let result =  <RenderSpecificTodo handleButtonClick={handleButtonClick} isVisible ={isVisible} currentTodo={currentTodo} getTodoParentsStringList={getTodoParentsStringList}/>
        if (isVisible) {
            result = <RenderSpecificTodo handleButtonClick={handleButtonClick} isVisible ={isVisible} currentTodo={currentTodo} getTodoParentsStringList={getTodoParentsStringList}/>
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
      
    
    
      const getTodoParentsStringList = (todoId: number): string[] => {
        const initTodo = getTodoById(todoId);
        let result: string[] = [];
      
        if (initTodo) {
          let parentIds = getTodoParentsList(initTodo);
      
          for (let i = 0; i < parentIds.length; i++) {
            result.push(getTodoNameById(parentIds[i]));
          };
        } else {
          console.log('Todo not found');
          return []; // Return an empty array if the todo is not found
        }
      
        return result; // Return the result array
      };
      


    return (
        <div className="App-header">
            <IsVisibleController />
        </div>
    );
}
