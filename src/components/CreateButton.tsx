import React, { useState } from 'react';
import supabase from '../utils/supabaseClient';

// Props type definition
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
  const [showForm, setShowForm] = useState(false);
  const [todo, setTodo] = useState<TodoType>({ name: '', urgent: false, important: false });

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
          {/* Form fields for the todo here */}
          {/* ... */}
          <button onClick={handleSubmit}>Confirm</button>
        </form>
      ) : (
        <button onClick={() => setShowForm(true)}>Create</button>
      )}
    </div>
  );
};

export default CreateButton;
