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
    </div>
  );
};

export default ViewTodoList;
