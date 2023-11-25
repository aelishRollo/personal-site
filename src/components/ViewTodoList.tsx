import React, { useState, useEffect } from 'react';
import supabase from '../utils/supabaseClient';

type TodoType = {
  id: number;
  name: string;
  urgent?: boolean;
  important?: boolean;
  parent_id?: number;
};

const ViewTodoList: React.FC = () => {
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

  //todos is accessible here



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
  
  //right now foo returns a list of id's of the family tree of todos. 

  //I want to have another function on top that will take that array, and for each one, get the
  //name of that todo, and add it to an array.
  //So through that process, the function will essentially convert an array of todo id's (numbers) to todo names (strings)

  const foo = () => {
    const todoId = 88; // Replace 1 with the actual ID you want to use
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
    <div>
      <h1>Todo List</h1>
      <table className="TodoTable">
        <thead>
          <tr>
            <th>Name</th>
            <th>Urgent</th>
            <th>Important</th>
            <th>Parent ID</th>
          </tr>
        </thead>
        <tbody>
          {todos.map((todo) => (
            <tr key={todo.id}>
              <td>{todo.name}</td>
              <td>{todo.urgent ? 'Yes' : 'No'}</td>
              <td>{todo.important ? 'Yes' : 'No'}</td>
              <td>{todo.parent_id}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={foo}>Step 2 </button>
    </div>
  );
};

export default ViewTodoList;
