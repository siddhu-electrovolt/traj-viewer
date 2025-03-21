# Traj Viewer

A modern, interactive trace visualization tool for analyzing and exploring hierarchical trace data. This application provides a clean and intuitive interface for viewing and analyzing trace spans, their relationships, and detailed information.

## Features

### Trace Visualization
- **Hierarchical View**: Visualize trace spans in a hierarchical tree structure
- **Interactive Timeline**: Visual representation of span durations and relationships
- **Expandable/Collapsible Nodes**: Easy navigation through the trace hierarchy
- **Progress Bars**: Visual indication of span duration and timing

### Detailed Information
- **Properties Panel**: View detailed information about selected spans
- **History View**: See all spans that occurred before the selected span in the hierarchy
- **Configuration Details**: View span-specific configuration settings
- **System Instructions**: Access to system instructions for agent spans
- **Input/Output Data**: Examine the input and output data for each span

### UI Features
- **Resizable Panels**: Adjustable split view between trace hierarchy and details
- **Custom Scrollbars**: Enhanced scrolling experience
- **Collapsible Sections**: Organized information in expandable/collapsible sections
- **File Upload**: Support for uploading .traj files
- **Visual Icons**: Distinct icons for different types of spans (agents, functions, handoffs)

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn package manager

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/siddhu-electrovolt/traj-viewer.git
   cd traj-viewer
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

### Running the Application
1. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

### Building for Production
1. Create a production build:
   ```bash
   npm run build
   # or
   yarn build
   ```

2. Start the production server:
   ```bash
   npm start
   # or
   yarn start
   ```

## Span Types
- **Agent Spans**: Represents agent activities with system instructions
- **Function Calls**: Shows function executions with arguments and outputs
- **Handoffs**: Visualizes transitions between agents
- **File Operations**: Displays file-related operations
- **Generations**: Shows generation events and responses

## Usage

1. **Loading Traces**
   - Click the "Upload File" button to load a .traj file
   - The trace hierarchy will be displayed in the left panel

2. **Navigating Traces**
   - Click on spans to view their details
   - Use the expand/collapse buttons to explore the hierarchy
   - Adjust the panel sizes using the center divider

3. **Viewing Details**
   - Select a span to view its properties and related information
   - The history section shows all spans that occurred before the selected span
   - Expand/collapse different sections to focus on relevant information

4. **Understanding Visualizations**
   - Progress bars show the relative timing and duration of spans
   - Icons indicate the type of span (agent, function, handoff, etc.)
   - Indentation and connecting lines show the hierarchical relationships

## File Format
The application accepts `.traj` files containing JSON-formatted trace data with the following structure:
```json
{
  "data": [{
    "object": "trace.span",
    "id": "span_id",
    "trace_id": "trace_id",
    "parent_id": "parent_span_id",
    "started_at": "timestamp",
    "ended_at": "timestamp",
    "span_data": {
      "type": "span_type",
      "name": "span_name",
      "input": [...],
      "output": [...],
      // Additional span-specific data
    }
  }]
}
```
