import React, { useState } from 'react';
import supabase from '../utils/supabaseClient';

// Props type definition. CreateButtonProps has a method, which has a TodoType as an argument
interface CreateButtonProps {
  onTodoCreated: (newTodo: TodoType) => void;
}

// Define the TodoType structure
type TodoType = {
  id?: number;
  name: string;
  urgent?: boolean;
  important?: boolean;
  parent_id?: number;
};

const CreateButton: React.FC<CreateButtonProps> = ({ onTodoCreated }) => {
  const [showForm, setShowForm] = useState(false);    //make showForm a boolean state variable
  const [todo, setTodo] = useState<TodoType>({ name: '', urgent: false, important: false }); //make todo:toDoType a state variable

  const handleSubmit = async () => {
    // Perform the insert into the database
    const { data, error } = await supabase.from('todos').insert([todo]);

    if (error) {
      console.error('Error inserting data:', error);
    } else if (data) {
      // Call the onTodoCreated prop with the new todo item
      onTodoCreated(data[0]);
      setShowForm(false); // Hide form after creation
    }
  };

  return (
    <div>
      {showForm ? (
        <form onSubmit={(e) => e.preventDefault()}>
        <div>
          <label htmlFor="title">Title:</label>
          <input type="text" id="title" name="title" />
        </div>
        <div>
          <label htmlFor="description">Description:</label>
          <textarea id="description" name="description"></textarea>
        </div>
        <div>
          <label htmlFor="dueDate">Due Date:</label>
          <input type="date" id="dueDate" name="dueDate" />
        </div>
        <button onClick={handleSubmit}>Confirm</button>
      </form>
      
      ) : (
        <button onClick={() => setShowForm(true)}>Create</button>
      )}
    </div>
  );
};

export default CreateButton;
