// Custom Matrix Chart Implementation for correlation charts
// This provides a simple working implementation without relying on the chartjs-chart-matrix plugin

(function() {
  console.log("Loading custom matrix controller implementation");
  
  if (typeof Chart === 'undefined') {
    console.error("Chart.js not available for custom matrix implementation");
    return;
  }
  
  // Define MatrixElement class
  class MatrixElement extends Chart.Element {
    static id = 'matrix';
    
    constructor(cfg) {
      super();
      this.x = undefined;
      this.y = undefined;
      this.width = undefined;
      this.height = undefined;
      
      if (cfg) {
        Object.assign(this, cfg);
      }
    }
    
    draw(ctx) {
      const { x, y, width, height, options } = this;
      
      // Skip if not visible
      if (width <= 0 || height <= 0) {
        return;
      }
      
      ctx.save();
      
      // Draw filled rectangle
      ctx.fillStyle = options.backgroundColor;
      ctx.fillRect(x, y, width, height);
      
      // Add border if needed
      if (options.borderWidth > 0) {
        ctx.strokeStyle = options.borderColor;
        ctx.lineWidth = options.borderWidth;
        ctx.strokeRect(x, y, width, height);
      }
      
      ctx.restore();
    }
    
    // Add inRange method required for tooltips and hover detection
    inRange(mouseX, mouseY, useFinalPosition) {
      const { x, y, width, height } = this.getProps(['x', 'y', 'width', 'height'], useFinalPosition);
      
      // Simple rectangular hit detection
      return (
        mouseX >= x && 
        mouseX <= x + width && 
        mouseY >= y && 
        mouseY <= y + height
      );
    }

    // Add getCenterPoint method required for event handling
    getCenterPoint(useFinalPosition) {
      const { x, y, width, height } = this.getProps(['x', 'y', 'width', 'height'], useFinalPosition);
      return {
        x: x + width / 2,
        y: y + height / 2
      };
    }
  }
  
  // Simple Matrix controller implementation
  class MatrixController extends Chart.DatasetController {
    static id = 'matrix';
    static datasetElementType = false;
    static dataElementType = MatrixElement.id;
    
    // Define which scales the controller requires
    static defaults = {
      dataElementType: MatrixElement.id,
      animations: {
        numbers: {
          type: 'number',
          properties: ['x', 'y', 'width', 'height']
        }
      },
      scales: {
        x: {
          type: 'category',
          offset: true
        },
        y: {
          type: 'category',
          offset: true
        }
      }
    };
    
    initialize() {
      super.initialize();
      console.log("Matrix controller initialized");
    }
    
    // Update the dataset elements with the new data and options
    update(mode) {
      const me = this;
      const meta = me.getMeta();
      
      // Update controller
      this.updateElements(meta.data || [], 0, (meta.data || []).length, mode);
    }
    
    // Update the individual elements
    updateElements(rectangles, start, count, mode) {
      const me = this;
      const reset = mode === 'reset';
      const dataset = me.getDataset();
      const xScale = me.getScaleForId('x');
      const yScale = me.getScaleForId('y');
      const data = dataset.data || [];
      
      const firstOpts = this.resolveDataElementOptions(start, mode);
      const sharedOptions = this.getSharedOptions(firstOpts);
      const includeOptions = this.includeOptions(mode, sharedOptions);
      
      for (let i = start; i < start + count; i++) {
        const index = i;
        const dataPoint = data[index] || {};
        
        const x = xScale.getPixelForValue(dataPoint.x, index);
        const y = yScale.getPixelForValue(dataPoint.y, index);
        
        // Calculate width and height based on scale
        const width = typeof dataset.width === 'function' ? 
                      dataset.width({chart: me.chart}) : 
                      (xScale.width / xScale.ticks.length) - 1;
        
        const height = typeof dataset.height === 'function' ? 
                       dataset.height({chart: me.chart}) : 
                       (yScale.height / yScale.ticks.length) - 1;
        
        // Create or update the element
        const properties = {
          x: x - width / 2,
          y: y - height / 2,
          width,
          height,
        };
        
        // Update the element's properties
        const element = (rectangles[i] || new MatrixElement());
        
        if (includeOptions) {
          properties.options = sharedOptions || this.resolveDataElementOptions(i, mode);
        }
        
        me.updateElement(element, i, properties, mode);
      }
      
      this.updateSharedOptions(sharedOptions, mode, firstOpts);
    }
    
    // Configure the element options
    resolveDataElementOptions(index, mode) {
      const me = this;
      const dataset = me.getDataset();
      const dataPoint = dataset.data[index] || {};
      const options = super.resolveDataElementOptions(index, mode);
      
      // Set background color based on value
      if (typeof dataset.backgroundColor === 'function') {
        options.backgroundColor = dataset.backgroundColor(dataPoint);
      }
      
      return options;
    }
    
    // Additional helper methods can be added as needed
  }
  
  // Register both the element and controller
  Chart.register(MatrixElement, MatrixController);
  
  // Create references for our modules
  window.MatrixElement = MatrixElement;
  window.MatrixController = MatrixController;
  
  // Let other code know we're ready
  console.log("Custom matrix controller and element registered successfully");
  window.dispatchEvent(new Event('MatrixPluginLoaded'));
})(); 