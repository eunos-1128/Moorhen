import { readDataFile, guid, rgbToHsv, hsvToRgb } from "./MoorhenUtils"
import { moorhen } from "../types/moorhen";
import { webGL } from "../types/mgWebGL";
import { libcootApi } from "../types/libcoot";
import MoorhenReduxStore from "../store/MoorhenReduxStore";

/**
 * Represents a map
 * @property {string} name - The name assigned to this map instance
 * @property {number} molNo - The imol assigned to this map instance
 * @property {number} mapRadius - The map radius currently displayed
 * @property {number} contourLevel - The map contour level currently displayed
 * @property {string} style - Indicates whether the rendered map is drawn as lines, lit lines or a solid surphace
 * @property {boolean} isDifference - Indicates whether this is a difference map instance
 * @property {boolean} hasReflectionData - Indicates whether this map instance has been associated with observed reflection data
 * @property {object} rgba - Object that stores the map colour and alpha
 * @property {React.RefObject<moorhen.CommandCentre>} commandCentre - A react reference to the command centre instance
 * @property {React.RefObject<webGL.MGWebGL>} glRef - A react reference to the MGWebGL instance
 * @constructor
 * @param {React.RefObject<moorhen.CommandCentre>} commandCentre - A react reference to the command centre instance
 * @param {React.RefObject<webGL.MGWebGL>} glRef - A react reference to the MGWebGL instance
 * @example
 * import { MoorhenMap } from "moorhen";
 * 
 * // Create a new map
 * const map = new MoorhenMap(commandCentre, glRef);
 * 
 * // Load file from a URL
 * const selectedColumns = { F: "FWT", PHI: "PHWT", Fobs: "FP", SigFobs: "SIGFP", FreeR: "FREE", isDifference: false, useWeight: false, calcStructFact: true }
 * map.loadToCootFromMtzURL("/uri/to/file.mtz", "map-1", selectedColumns);
 * 
 * // Draw map and set view on map centre
 * map.drawMapContour();
 * map.centreOnMap();
 * 
 * // Delete map
 * map.delete();
*/

const _DEFAULT_CONTOUR_LEVEL = 0.8
const _DEFAULT_RADIUS = 13
const _DEFAULT_STYLE = "lines"
const _DEFAULT_ALPHA = 1.0
const _DEFAULT_MAP_COLOUR = { r: 0.30000001192092896, g: 0.30000001192092896, b: 0.699999988079071}
const _DEFAULT_POSITIVE_MAP_COLOUR = {r: 0.4000000059604645, g: 0.800000011920929, b: 0.4000000059604645}
const _DEFAULT_NEGATIVE_MAP_COLOUR = {r: 0.800000011920929, g: 0.4000000059604645, b: 0.4000000059604645}

export class MoorhenMap implements moorhen.Map {
    
    type: string
    name: string
    isEM: boolean
    molNo: number
    commandCentre: React.RefObject<moorhen.CommandCentre>
    glRef: React.RefObject<webGL.MGWebGL>
    mapCentre: [number, number, number]
    suggestedContourLevel: number
    suggestedRadius: number
    webMGContour: boolean
    showOnLoad: boolean
    displayObjects: any
    isDifference: boolean
    hasReflectionData: boolean
    selectedColumns: moorhen.selectedMtzColumns
    associatedReflectionFileName: string
    uniqueId: string
    mapRmsd: number
    suggestedMapWeight: number
    otherMapForColouring: {molNo: number, min: number, max: number};
    diffMapColourBuffers: { positiveDiffColour: number[], negativeDiffColour: number[] }
    defaultMapColour: {r: number, g: number, b: number};
    defaultPositiveMapColour: {r: number, g: number, b: number};
    defaultNegativeMapColour: {r: number, g: number, b: number};

    constructor(commandCentre: React.RefObject<moorhen.CommandCentre>, glRef: React.RefObject<webGL.MGWebGL>) {
        this.type = 'map'
        this.name = "unnamed"
        this.isEM = false
        this.molNo = null
        this.commandCentre = commandCentre
        this.glRef = glRef
        this.webMGContour = false
        this.showOnLoad = true
        this.displayObjects = { Coot: [] }
        this.isDifference = false
        this.hasReflectionData = false
        this.selectedColumns = null
        this.associatedReflectionFileName = null
        this.uniqueId = guid()
        this.mapRmsd = null
        this.suggestedMapWeight = null
        this.suggestedContourLevel = null
        this.suggestedRadius = null
        this.mapCentre = null
        this.otherMapForColouring = null
        this.diffMapColourBuffers = { positiveDiffColour: [], negativeDiffColour: [] }
        this.defaultMapColour = _DEFAULT_MAP_COLOUR
        this.defaultPositiveMapColour = _DEFAULT_POSITIVE_MAP_COLOUR
        this.defaultNegativeMapColour = _DEFAULT_NEGATIVE_MAP_COLOUR
    }

    /**
     * Helper function to set this map instance as the "active" map for refinement
     */
    async setActive(): Promise<void> {
        await this.commandCentre.current.cootCommand({
            returnType: "status",
            command: "set_imol_refinement_map",
            commandArgs: [this.molNo]
        }, false)
        if (this.suggestedMapWeight === null) {
            await this.estimateMapWeight()
        }
        await this.setMapWeight()
    }

    /**
     * Delete the map instance
     */
    async delete(): Promise<void> {
        Object.getOwnPropertyNames(this.displayObjects).forEach(displayObject => {
            if (this.displayObjects[displayObject].length > 0) { this.clearBuffersOfStyle(displayObject) }
        })
        this.glRef.current.drawScene()
        const promises = [
            this.commandCentre.current.cootCommand({
                returnType: "status",
                command: 'close_molecule',
                commandArgs: [this.molNo]
            }, true),
            this.hasReflectionData ?
                this.commandCentre.current.postMessage({
                    message: 'delete_file_name', fileName: this.associatedReflectionFileName
                })
                :
                Promise.resolve(true)
        ]
        await Promise.all(promises)
    }

    /**
     * Replace the current map with the contents of a MTZ file
     * @param {string} fileUrl - The uri to the MTZ file
     * @param {moorhen.selectedMtzColumns} selectedColumns - Object indicating the selected MTZ columns
     * @returns {Promise<void>}
     */
    async replaceMapWithMtzFile(fileUrl: RequestInfo | URL, selectedColumns: moorhen.selectedMtzColumns): Promise<void> {
        let mtzData: Uint8Array
        let fetchResponse: Response

        try {
            fetchResponse = await fetch(fileUrl)
        } catch (err) {
            return Promise.reject(`Unable to fetch file ${fileUrl}`)
        }

        if (fetchResponse.ok) {
            const reflectionData = await fetchResponse.blob()
            const arrayBuffer = await reflectionData.arrayBuffer()
            mtzData = new Uint8Array(arrayBuffer)
        } else {
            return Promise.reject(`Error fetching data from url ${fileUrl}`)
        }

        const cootResponse = await this.commandCentre.current.cootCommand({
            returnType: "status",
            command: 'shim_replace_map_by_mtz_from_file',
            commandArgs: [this.molNo, mtzData, selectedColumns]
        }, true) as moorhen.WorkerResponse<number>

        if (cootResponse.data.result.status === 'Completed') {
            return this.drawMapContour()
        }

        return Promise.reject(cootResponse.data.result.status)

    }

    /**
     * Load map to moorhen using a MTZ url
     * @param {string} url - The url to the MTZ file
     * @param {string} name - The name that will be assigned to the map
     * @param {moorhen.selectedMtzColumns} selectedColumns - Object indicating the selected MTZ columns
     * @param {object} [options] - Options passed to fetch API
     * @returns {Pormise<moorhen.Map>} This moorhenMap instance
     */
    async loadToCootFromMtzURL(url: RequestInfo | URL, name: string, selectedColumns: moorhen.selectedMtzColumns, options?: RequestInit): Promise<moorhen.Map> {

        try {
            const response = await fetch(url, options)
            if (!response.ok) {
                return Promise.reject(`Error fetching data from url ${url}`)
            }
            const reflectionData: Blob = await response.blob()
            const arrayBuffer: ArrayBuffer = await reflectionData.arrayBuffer()
            const asUIntArray: Uint8Array = new Uint8Array(arrayBuffer)
            await this.loadToCootFromMtzData(asUIntArray, name, selectedColumns)
            if (selectedColumns.calcStructFact) {
                await this.associateToReflectionData(selectedColumns, asUIntArray)
            }
            return this
        } catch (err) {
            console.log(err)
            return Promise.reject(err)
        }
    }

    /**
     * Load map to moorhen using MTZ data
     * @param {Uint8Array} data - The mtz data
     * @param {string} name - The name that will be assigned to the map
     * @param {moorhen.selectedMtzColumns} selectedColumns - Object indicating the selected MTZ columns
     * @returns {Pormise<moorhen.Map>} This moorhenMap instance
     */
    async loadToCootFromMtzData(data: Uint8Array, name: string, selectedColumns: moorhen.selectedMtzColumns): Promise<moorhen.Map> {
        this.name = name
        try {
            const reply = await this.commandCentre.current.cootCommand({
                returnType: "status",
                command: "shim_read_mtz",
                commandArgs: [data, name, selectedColumns]
            }, true)
            if (reply.data.result.status === 'Exception') {
                return Promise.reject(reply.data.result.consoleMessage)
            }
            this.molNo = reply.data.result.result
            this.selectedColumns = selectedColumns
            if (Object.keys(selectedColumns).includes('isDifference')) {
                this.isDifference = selectedColumns.isDifference
            }
            await this.getSuggestedSettings()
            return this    
        } catch(err) {
            return Promise.reject(err)
        }
    }

    /**
     * Load map to moorhen from a MTZ file
     * @param {File} source - The MTZ file
     * @param {moorhen.selectedMtzColumns} selectedColumns - Object indicating the selected MTZ columns
     * @returns {Promise<moorhen.Map>} This moorhenMap instance
     */
    loadToCootFromMtzFile = async function (source: File, selectedColumns: moorhen.selectedMtzColumns): Promise<moorhen.Map> {
        const $this = this
        let reflectionData = await readDataFile(source)
        const asUIntArray = new Uint8Array(reflectionData)
        await $this.loadToCootFromMtzData(asUIntArray, source.name, selectedColumns)
        if (selectedColumns.calcStructFact) {
            await $this.associateToReflectionData(selectedColumns, asUIntArray)
        }
        return $this
    }

    /**
     * Load map to moorhen from a map file url
     * @param {string} url - The url to the MTZ file
     * @param {string} name - The name that will be assigned to the map
     * @param {boolean} [isDiffMap=false] - Indicates whether the new map is a difference map
     * @param {object} [options] - Options passed to fetch API
     * @returns {Promise<moorhen.Map>} This moorhenMap instance
     */
    async loadToCootFromMapURL(url: RequestInfo | URL, name: string, isDiffMap: boolean= false, options?: RequestInit): Promise<moorhen.Map>  {

        try {
            const response = await fetch(url, options);
            const mapData = await response.blob();
            const arrayBuffer = await mapData.arrayBuffer();
            return await this.loadToCootFromMapData(new Uint8Array(arrayBuffer), name, isDiffMap);
        } catch (err) {
            return await Promise.reject(err);
        }
    }

    /**
     * Load map to moorhen from map data
     * @param {ArrayBuffer | Uint8Array} data - The map data in the form of a array buffer
     * @param {string} name - The name that will be assigned to the map
     * @param {boolean} isDiffMap - Indicates whether the new map is a difference map
     * @returns {Promise<moorhen.Map>} This moorhenMap instance
     */
    async loadToCootFromMapData(data: ArrayBuffer | Uint8Array, name: string, isDiffMap: boolean): Promise<moorhen.Map> {
        this.name = name
        try {
            const reply = await this.commandCentre.current.cootCommand({
                returnType: "status",
                command: "shim_read_ccp4_map",
                commandArgs: [data, name, isDiffMap]
            }, true)
            if (reply.data.result?.status === 'Exception') {
                return Promise.reject(reply.data.result.consoleMessage)
            }
            this.molNo = reply.data.result.result
            this.isDifference = isDiffMap
            await this.getSuggestedSettings()
            return this    
        } catch(err) {
            return Promise.reject(err)
        }
    }

    /**
     * Load a map to moorhen from a map file data blob
     * @param {File} source - The map file
     * @param {boolean} isDiffMap - Indicates whether the new map is a difference map
     * @returns {Promise<moorhen.Map>} This moorhenMap instance
     */
    async loadToCootFromMapFile (source: File, isDiffMap: boolean): Promise<moorhen.Map> {
        const mapData = await readDataFile(source)
        const asUIntArray = new Uint8Array(mapData)
        return this.loadToCootFromMapData(asUIntArray, source.name, isDiffMap)
    }

    /**
     * Get the current map
     * @returns {Promise<moorhen.WorkerResponse>} A worker response with the map arrayBuffer
     */
    getMap(): Promise<moorhen.WorkerResponse> {
        return this.commandCentre.current.postMessage({
            message: 'get_map',
            molNo: this.molNo
        })
    }

    /**
     * Set the map weight
     * @param {number} [weight=moorhen.Map.suggestedMapWeight] - The new map weight
     * @returns {Promise<moorhen.WorkerResponse>} Void worker response
     */
    setMapWeight(weight?: number): Promise<moorhen.WorkerResponse> {
        let newWeight: number
        if (typeof weight !== 'undefined') {
            newWeight = weight
        }
        else {
            newWeight = this.suggestedMapWeight
        }
        return this.commandCentre.current.cootCommand({
            returnType: 'status',
            command: "set_map_weight",
            commandArgs: [newWeight]
        }, false)
    }

    /**
     * Get the current map weight
     * @returns {Promise<number>} The current map weight
     */
    async getMapWeight(): Promise<number> {
        const result = await this.commandCentre.current.cootCommand({
            returnType: 'status',
            command: "get_map_weight",
            commandArgs: []
        }, false) as moorhen.WorkerResponse<number>
        return result.data.result.result
    }

    /**
     * Get map contour parameters from the redux store
     * @returns {object} A description of map contour parameters as described in the redux store
     */
    getMapContourParams(): { 
        mapRadius: number; 
        contourLevel: number; 
        mapAlpha: number; 
        mapStyle: "lines" | "solid" | "lit-lines"; 
        mapColour: {r: number; g: number; b: number}; 
        positiveMapColour: {r: number; g: number; b: number}; 
        negativeMapColour: {r: number; g: number; b: number}
    } {
        const state = MoorhenReduxStore.getState()
        const radius = state.mapContourSettings.mapRadii.find(item => item.molNo === this.molNo)?.radius
        const level = state.mapContourSettings.contourLevels.find(item => item.molNo === this.molNo)?.contourLevel
        const alpha = state.mapContourSettings.mapAlpha.find(item => item.molNo === this.molNo)?.alpha
        const style = state.mapContourSettings.mapStyles.find(item => item.molNo === this.molNo)?.style
        const mapColour = state.mapContourSettings.mapColours.find(item => item.molNo === this.molNo)?.rgb
        const negativeMapColour = state.mapContourSettings.negativeMapColours.find(item => item.molNo === this.molNo)?.rgb
        const positiveMapColour = state.mapContourSettings.positiveMapColours.find(item => item.molNo === this.molNo)?.rgb
        return {
            mapRadius: radius ? radius : _DEFAULT_RADIUS, 
            contourLevel: level ? level : _DEFAULT_CONTOUR_LEVEL,
            mapAlpha: alpha ? alpha : _DEFAULT_ALPHA,
            mapStyle: style ? style : _DEFAULT_STYLE,
            mapColour: mapColour ? {r: mapColour.r / 255., g: mapColour.g / 255., b: mapColour.b / 255.} : this.defaultMapColour,
            negativeMapColour: negativeMapColour ? {r: negativeMapColour.r / 255., g: negativeMapColour.g / 255., b: negativeMapColour.b / 255.} : this.defaultNegativeMapColour,
            positiveMapColour: positiveMapColour ? {r: positiveMapColour.r / 255., g: positiveMapColour.g / 255., b: positiveMapColour.b / 255.} : this.defaultPositiveMapColour  
        }
    }

    /**
     * Contour the map with parameters from the redux store
     */
    drawMapContour(): Promise<void> {
        const { mapRadius, contourLevel, mapStyle } = this.getMapContourParams()
        return this.doCootContour(...this.glRef.current.origin.map(coord => -coord) as [number, number, number], mapRadius, contourLevel, mapStyle)
    }

    /**
     * Hide the map
     */
    hideMapContour(): void {
        this.clearBuffersOfStyle('Coot')
        this.glRef.current.buildBuffers();
        this.glRef.current.drawScene();
    }

    /**
     * Clear MGWebGL buffers of a given style for this map
     * @param {string} style - The map style that will be cleared
     */
    clearBuffersOfStyle(style: string): void {
        //Empty existing buffers of this type
        this.displayObjects[style].forEach((buffer) => {
            buffer.clearBuffers()
            this.glRef.current.displayBuffers = this.glRef.current.displayBuffers?.filter(glBuffer => glBuffer.id !== buffer.id)
        })
        this.displayObjects[style] = []
    }

    setupContourBuffers(objects: any[], keepCootColours: boolean = false) {
        const { mapAlpha, mapColour, positiveMapColour, negativeMapColour } = this.getMapContourParams()
        const print_timing = false;
        const t1 = performance.now();
        try {
            const diffMapColourBuffers = { positiveDiffColour: [], negativeDiffColour: [] }
            objects.filter(object => typeof object !== 'undefined' && object !== null).forEach(object => {
                let object_positive;
                let object_negative;
                if (this.isDifference) {
                    object_positive = structuredClone(object);
                    object_negative = structuredClone(object);
                    object_positive.idx_tri = [];
                    object_negative.idx_tri = [];
                    const tc = performance.now();
                    if(print_timing) console.log("End clone",tc-t1);
                    let i = 0;
                    object.idx_tri.forEach((idxss: number[][]) => {
                        let j = 0;
                        let pos_idx = [];
                        let neg_idx = [];
                        idxss.forEach((idxs: number[]) => {
                            let this_pos_idx = [];
                            let this_neg_idx = [];
                            for (let idx = 0; idx < idxs.length; idx++) {
                                const col = object.col_tri[i][j][idxs[idx]*4]
                                if (col < 0.5) {
                                    this_pos_idx.push(idxs[idx])
                                    diffMapColourBuffers.positiveDiffColour.push(idxs[idx]*4)
                                    object_positive.col_tri[i][j][idxs[idx]*4]   = positiveMapColour.r
                                    object_positive.col_tri[i][j][idxs[idx]*4+1] = positiveMapColour.g
                                    object_positive.col_tri[i][j][idxs[idx]*4+2] = positiveMapColour.b
                                    object_positive.col_tri[i][j][idxs[idx]*4+3] = mapAlpha
                                } else {
                                    this_neg_idx.push(idxs[idx])
                                    diffMapColourBuffers.negativeDiffColour.push(idxs[idx]*4)
                                    object_negative.col_tri[i][j][idxs[idx]*4]   = negativeMapColour.r
                                    object_negative.col_tri[i][j][idxs[idx]*4+1] = negativeMapColour.g
                                    object_negative.col_tri[i][j][idxs[idx]*4+2] = negativeMapColour.b
                                    object_negative.col_tri[i][j][idxs[idx]*4+3] = mapAlpha
                                }
                            }
                            pos_idx.push(this_pos_idx)
                            neg_idx.push(this_neg_idx)
                            j++;
                        })
                        object_positive.idx_tri.push(pos_idx)
                        object_negative.idx_tri.push(neg_idx)
                        i++;
                    })
                    const tl = performance.now();
                    if(print_timing) console.log("End loop",tl-t1)
                } else if (!keepCootColours)  {
                    if (mapAlpha < 0.98) {
                        object.col_tri.forEach((cols: number[][]) => {
                            cols.forEach((col: number[]) => {
                                for (let idx = 0; idx < col.length; idx += 4) {
                                    col[idx] = mapColour.r
                                    col[idx + 1] = mapColour.g
                                    col[idx + 2] = mapColour.b
                                    col[idx + 3] = mapAlpha
                                }
                            })
                        })
                    }
                    const tl = performance.now();
                    if(print_timing) console.log("End loop",tl-t1)
                }
                if (this.isDifference) {
                    this.clearBuffersOfStyle("Coot")
                    let a = this.glRef.current.appendOtherData(object_positive, true);
                    let b = this.glRef.current.appendOtherData(object_negative, true);
                    if(mapAlpha<0.99){
                        a[0].transparent = true;
                        b[0].transparent = true;
                    }
                    const ta = performance.now();
                    if(print_timing) console.log("End appendOtherData",ta-t1);
                    this.diffMapColourBuffers.positiveDiffColour = this.diffMapColourBuffers.positiveDiffColour.concat(diffMapColourBuffers.positiveDiffColour);
                    this.diffMapColourBuffers.negativeDiffColour = this.diffMapColourBuffers.negativeDiffColour.concat(diffMapColourBuffers.negativeDiffColour);
                    this.displayObjects['Coot'] = this.displayObjects['Coot'].concat(a);
                    this.displayObjects['Coot'] = this.displayObjects['Coot'].concat(b);
                } else if (!keepCootColours) {
                    //console.log("DEBUG: Old buffers?", object.vert_tri[0][0],object.norm_tri[0][0])
                    if(this.displayObjects["Coot"].length>0 && (object.prim_types[0][0]===this.displayObjects["Coot"][0].bufferTypes[0])){
                        this.displayObjects["Coot"][0].triangleVertices[0] = object.vert_tri[0][0]
                        this.displayObjects["Coot"][0].triangleNormals[0] = object.norm_tri[0][0]
                        if(mapAlpha>0.98){
                            //console.log("DEBUG: Old buffers setCustomColour")
                            this.displayObjects["Coot"][0].setCustomColour([mapColour.r,mapColour.g,mapColour.b,1.0])
                        } else {
                            this.displayObjects["Coot"][0].triangleColours[0] = object.col_tri[0][0]
                        }
                        this.displayObjects["Coot"][0].triangleIndexs[0] = object.idx_tri[0][0]
                        this.displayObjects["Coot"][0].isDirty = true
                    } else {
                       this.clearBuffersOfStyle("Coot")
                       let a = this.glRef.current.appendOtherData(object, true);
                       if(mapAlpha>0.98){
                           a[0].setCustomColour([mapColour.r,mapColour.g,mapColour.b,1.0])
                       }
                       this.displayObjects['Coot'] = this.displayObjects['Coot'].concat(a);
                    }

                    const ta = performance.now();
                    if(print_timing) console.log("End appendOtherData",ta-t1);
                    this.diffMapColourBuffers.positiveDiffColour = this.diffMapColourBuffers.positiveDiffColour.concat(diffMapColourBuffers.positiveDiffColour);
                    this.diffMapColourBuffers.negativeDiffColour = this.diffMapColourBuffers.negativeDiffColour.concat(diffMapColourBuffers.negativeDiffColour);
                } else {
                    //console.log("MOORHEN MAP do what keepCootColours wants")
                    this.clearBuffersOfStyle("Coot")
                    let a = this.glRef.current.appendOtherData(object, true);
                    this.displayObjects['Coot'] = this.displayObjects['Coot'].concat(a);
                }
            })
            if(print_timing) console.log("Start buildBuffers");
            this.glRef.current.buildBuffers();
            const tb = performance.now();
            if(print_timing) console.log("End buildBuffers",tb-t1);
            this.glRef.current.drawScene();
            const ts = performance.now();
            if(print_timing) console.log("After drawScene",ts-t1);
        } catch(err) {
            //console.log(err)
        } 
        const t2 = performance.now();
        if(print_timing) console.log("Finished setupContourBuffers",t2-t1)
    }

    /**
     * Draw the map contour around a given origin
     * @param {number} x - Origin coord. X
     * @param {number} y - Origin coord. Y
     * @param {number} z - Origin coord. Z
     * @param {number} radius - Radius around the origin that will be drawn
     * @param {number} contourLevel - The map contour level
     */
    async doCootContour(x: number, y: number, z: number, radius: number, contourLevel: number, style: "solid" | "lines" | "lit-lines"): Promise<void> {

        let returnType: string
        if (style === 'solid') {
            returnType = "mesh_perm"
        } else if (style === 'lit-lines') {
            returnType = "lit_lines_mesh"
        } else {
            returnType = "lines_mesh"
        }

        let response: moorhen.WorkerResponse<any>
        if (this.otherMapForColouring !== null) {
            response = await this.commandCentre.current.cootCommand({
                returnType: returnType,
                command: "get_map_contours_mesh_using_other_map_for_colours",
                commandArgs: [this.molNo, this.otherMapForColouring.molNo, x, y, z, radius, contourLevel, this.otherMapForColouring.min, this.otherMapForColouring.max, false]
            }, false)
        } else {
            response = await this.commandCentre.current.cootCommand({
                returnType: returnType,
                command: "get_map_contours_mesh",
                commandArgs: [this.molNo, x, y, z, radius, contourLevel]
            }, false)
        }

        const objects = [response.data.result.result]
        this.setupContourBuffers(objects, this.otherMapForColouring !== null)
    }

    /**
     * Set colouring for this map instance based on another map
     * @param {number} molNo - The imol for the other map
     * @param {number} min - The min value
     * @param {number} max - The max value
     */
    setOtherMapForColouring(molNo: number, min: number = -0.9, max: number = 0.9) {
        if (molNo === null) {
            this.otherMapForColouring = null
        } else {
            this.otherMapForColouring = { molNo, min, max }
        }
    }

    /**
     * Fetch the colours for a difference map using values from redux store and redraw the map
     * @param {'positiveDiffColour' | 'negativeDiffColour'} type - Indicates whether the negative or positive colours will be set
     * @returns {Promise<void>}
     */
    async fetchDiffMapColourAndRedraw(type: 'positiveDiffColour' | 'negativeDiffColour'): Promise<void> {
        if (!this.isDifference) {
            console.error('Cannot use moorhen.Map.fetchDiffMapColourAndRedraw to change non-diff map colour. Use moorhen.Map.setColour instead...')
            return
        }
        
        const { mapAlpha, positiveMapColour, negativeMapColour } = this.getMapContourParams()
        const mapColour = type === 'positiveDiffColour' ? positiveMapColour : negativeMapColour
       
        if (mapAlpha < 0.99) {
            this.displayObjects['Coot'].forEach((buffer, bufferIdx) => {
                buffer.customColour = null;
                buffer.transparent = true
                buffer.triangleColours.forEach((colbuffer, colBufferIdx) => {
                    for (const idx of this.diffMapColourBuffers[type]) {
                        colbuffer[idx] = mapColour.r
                        colbuffer[idx + 1] = mapColour.g
                        colbuffer[idx + 2] = mapColour.b
                    }
                })
                buffer.isDirty = true
                buffer.alphaChanged = true;
            })
        } else {
            if(this.displayObjects['Coot'].length===2){
                if(type==='positiveDiffColour'){
                    this.displayObjects['Coot'][0].setCustomColour([mapColour.r,mapColour.g,mapColour.b,1.0])
                    this.displayObjects['Coot'][0].transparent = false
                } else {
                    this.displayObjects['Coot'][1].setCustomColour([mapColour.r,mapColour.g,mapColour.b,1.0])
                    this.displayObjects['Coot'][1].transparent = false
                }
            }
        }
        
        if (mapAlpha < 0.99) {
            this.glRef.current.buildBuffers();
        }

        this.glRef.current.drawScene();
    }

    /**
     * Set the colours for a non-difference map using values from redux store
     * @param {boolean} [redraw=true] - Indicates whether the map needs to be redrawn after setting the new colours
     * @returns {Promise<void>}
     */
    async setColour(redraw: boolean = true): Promise<void> {
        if (this.isDifference) {
            console.error('Cannot use moorhen.Map.setColour to change difference map colour. Use moorhen.Map.fetchDiffMapColourAndRedraw instead...')
            return
        }

        if (this.otherMapForColouring !== null) {
            this.otherMapForColouring = null
        }
        
        const { mapAlpha, mapColour } = this.getMapContourParams()
        
        this.displayObjects['Coot'].forEach(buffer => {
            if (mapAlpha < 0.99) {
                buffer.customColour = null;
                buffer.transparent = true
                buffer.triangleColours.forEach(colbuffer => {
                    for (let idx = 0; idx < colbuffer.length; idx += 4) {
                        colbuffer[idx] = mapColour.r
                        colbuffer[idx + 1] = mapColour.g
                        colbuffer[idx + 2] = mapColour.b
                    }
                })
                buffer.isDirty = true;
                buffer.alphaChanged = true;
            } else {
                buffer.setCustomColour([mapColour.r,mapColour.g,mapColour.b,1.0])
                buffer.transparent = false
            }
        })

        if (mapAlpha < 0.99) {
            this.glRef.current.buildBuffers();
        }

        if (redraw) {
            this.glRef.current.drawScene();
        }
    }

    /**
     * Fetch the map alpha (transparency) for this map using values from redux store and redraw the map
     */
    async fetchMapAlphaAndRedraw(): Promise<void> {
        const { mapAlpha, mapColour } = this.getMapContourParams()
        this.displayObjects['Coot'].forEach(buffer => {
            buffer.triangleColours.forEach(colbuffer => {
                if (this.isDifference) {
                    console.log("Setting alpha", mapAlpha)
                }
                for (let idx = 3; idx < colbuffer.length; idx += 4) {
                    colbuffer[idx] = mapAlpha
                }
            })
            buffer.isDirty = true
            buffer.alphaChanged = true
            if (mapAlpha < 0.99) {
                buffer.transparent = true
                if (buffer.customColour && buffer.customColour.length===4) {
                    buffer.customColour = null;
                    if (this.isDifference) {
                        console.log("Setting colours to",mapColour)
                    }
                    buffer.triangleColours.forEach(colbuffer => {
                        for (let idx = 0; idx < colbuffer.length; idx += 4) {
                            colbuffer[idx] = mapColour.r
                            colbuffer[idx + 1] = mapColour.g
                            colbuffer[idx + 2] = mapColour.b
                        }
                    })
                }
            } else {
                buffer.transparent = false
                if (buffer.customColour && buffer.customColour.length === 4) {
                    buffer.setCustomColour([mapColour.r, mapColour.g, mapColour.b, 1.0])
                }
            }
        })
        this.glRef.current.buildBuffers();
        this.glRef.current.drawScene();
    }

    /**
     * Associate this map with a set of observed reflections
     * @param {moorhen.selectedMtzColumns} selectedColumns - Object indicating the selected MTZ columns
     * @param {Uint8Array} reflectionData - The reflection data that will be associates to this map
     * @returns {Promise<moorhen.WorkerResponse>} - Void promise
     */
    async associateToReflectionData (selectedColumns: moorhen.selectedMtzColumns, reflectionData: Uint8Array | ArrayBuffer): Promise<void> {
        if (!selectedColumns.Fobs || !selectedColumns.SigFobs || !selectedColumns.FreeR) {
            console.warn('WARNING: Missing column data, cannot associate reflection data with map')
            return Promise.resolve()
        }

        const commandArgs = [
            this.molNo, { fileName: this.uniqueId, data: reflectionData },
            selectedColumns.Fobs, selectedColumns.SigFobs, selectedColumns.FreeR
        ]

        const response = await this.commandCentre.current.cootCommand({
            command: 'shim_associate_data_mtz_file_with_map',
            commandArgs: commandArgs,
            returnType: 'status'
        }, false) as moorhen.WorkerResponse<string>

        if (response.data.result.status === "Completed") {
            this.hasReflectionData = true
            this.selectedColumns = {
                ...this.selectedColumns,
                ...selectedColumns
            }
            this.associatedReflectionFileName = response.data.result.result
        } else {
            console.warn('Unable to associate reflection data with map')
        }
    }

    /**
     * Fetch the reflection data associated with this map
     * @returns {Promise<moorhen.WorkerResponse<Uint8Array>>} The reflection data
     */
    async fetchReflectionData(): Promise<moorhen.WorkerResponse<Uint8Array>> {
        if (this.hasReflectionData) {
            return await this.commandCentre.current.postMessage({
                molNo: this.molNo,
                message: 'get_mtz_data',
                fileName: this.associatedReflectionFileName
            })
        } else {
            console.log('Map has no reflection data associated...')
        }
    }

    /**
     * Create a copy of the map
     * @returns {Promise<moorhen.Map>} New map instance
     */
    async duplicate(): Promise<moorhen.Map> {
        const reply = await this.getMap()
        const newMap = new MoorhenMap(this.commandCentre, this.glRef)
        await newMap.loadToCootFromMapData(reply.data.result.mapData, `Copy of ${this.name}`, this.isDifference)
        const { mapRadius, contourLevel } = this.getMapContourParams()
        newMap.suggestedContourLevel = contourLevel
        newMap.suggestedRadius = mapRadius
        return newMap
    }

    /**
     * Blur the map
     * @param {number} bFactor - The b-factor used for blurring
     * @returns {Promise<moorhen.WorkerResponse<number>>} Status (-1 if failure)
     */
    blur(bFactor: number): Promise<moorhen.WorkerResponse> {
        return this.commandCentre.current.cootCommand({
            command: 'sharpen_blur_map',
            commandArgs: [this.molNo, bFactor, true],
            returnType: "status"
        }, true) as Promise<moorhen.WorkerResponse<number>>
    }

    /**
     * Get the current map RMSD
     * @returns {number} The map RMSD
     */
    async fetchMapRmsd(): Promise<number> {
        const result = await this.commandCentre.current.cootCommand({
            command: 'get_map_rmsd_approx',
            commandArgs: [this.molNo],
            returnType: 'float'
        }, false) as moorhen.WorkerResponse<number>
        this.mapRmsd = result.data.result.result
        return result.data.result.result
    }

    /**
     * Get the suggested level for this map instance (only for MX maps)
     * @returns {number} The suggested map contour level
     */
    async fetchSuggestedLevel(): Promise<number> {
        const result = await this.commandCentre.current.cootCommand({
            command: 'get_suggested_initial_contour_level',
            commandArgs: [this.molNo],
            returnType: 'float'
        }, false) as moorhen.WorkerResponse<number>
        
        if (result.data.result.result !== -1) {
            this.suggestedContourLevel = result.data.result.result
        } else {
            console.log('Problem getting suggested intial map level')
            this.suggestedContourLevel = null 
        }
        
        return result.data.result.result
    }

    /**
     * Get the suggested map centre for this map instance (it will also fetch suggested level for EM maps)
     * @returns {number[]} The map centre
     */
    async fetchMapCentre(): Promise<[number, number, number]> {
        const response = await this.commandCentre.current.cootCommand({
            command: 'get_map_molecule_centre',
            commandArgs: [this.molNo],
            returnType: "map_molecule_centre_info_t"
        }, false) as moorhen.WorkerResponse<libcootApi.MapMoleculeCentreInfoJS>
        
        if (response.data.result.result.success) {
            this.mapCentre = response.data.result.result.updated_centre.map(coord => -coord) as [number, number, number]
            if (this.isEM) {
                this.suggestedContourLevel = response.data.result.result.suggested_contour_level
                this.suggestedRadius = response.data.result.result.suggested_radius
            }
        } else {
            console.log('Problem finding map centre')
            this.mapCentre = null
        }
        
        return this.mapCentre
    }

    /**
     * Estimate the map weight based on the map rmsd
     */
    async estimateMapWeight(): Promise<void> {
        if (this.mapRmsd === null) {
            await this.fetchMapRmsd()
        }
        this.suggestedMapWeight = 50 * 0.3 / this.mapRmsd
    }
    
    /**
     * Get suggested contour level, radius and map centre for this map instance
     */
    async getSuggestedSettings(): Promise<void> {

        const response = await this.commandCentre.current.cootCommand({
            command: 'is_EM_map',
            commandArgs: [this.molNo],
            returnType: "boolean"
        }, false) as moorhen.WorkerResponse<boolean>
        
        this.isEM = response.data.result.result
       
        await Promise.all([
            this.fetchMapRmsd().then(_ => this.estimateMapWeight()),
            this.fetchMapCentre(),
            this.setDefaultColour(),
            !this.isEM && this.fetchSuggestedLevel()
        ])
    }

    /**
     * Set the view in the centre of this map instance
     */
    async centreOnMap(): Promise<void> {
        if (this.mapCentre === null) {
            await this.fetchMapCentre()
            if (this.mapCentre === null) {
                console.log('Problem finding map centre')
                return
            }
        }
        this.glRef.current.setOriginAnimated(this.mapCentre)
    }

    /**
     * Get the histogram data for this map instance
     * @returns {object} - An object with the histogram data
     */
    async getHistogram(nBins: number = 200, zoomFactor: number = 1): Promise<libcootApi.HistogramInfoJS> {
        const response = await this.commandCentre.current.cootCommand({
            command: 'get_map_histogram',
            commandArgs: [this.molNo, nBins, zoomFactor],
            returnType: "histogram_info_t"
        }, false) as moorhen.WorkerResponse<any>
        return response.data.result.result
    }

    /**
     * Fetch whether this is a difference map
     * @returns {boolean} - True if this map instance is a difference map
     */
    async fetchIsDifferenceMap(): Promise<boolean> {
        const isDifferenceMap = await this.commandCentre.current.cootCommand({
            command: 'is_a_difference_map',
            commandArgs: [this.molNo],
            returnType: "boolean"
        }, false) as moorhen.WorkerResponse<boolean>
        this.isDifference = isDifferenceMap.data.result.result
        return this.isDifference
    }

    /**
     * Set the default colour for this map depending on the current number of maps loaded in the session
     */
    async setDefaultColour(): Promise<void> {
        if (this.isDifference) {
            return
        }
        
        const validMapMolNos = await Promise.all([...Array(this.molNo).keys()].map(async (molNo) => {
            if (molNo === this.molNo) {
                return false
            }
            const isValidMap = await this.commandCentre.current.cootCommand({
                command: 'is_valid_map_molecule',
                commandArgs: [molNo],
                returnType: "boolean"
            }, false) as moorhen.WorkerResponse<boolean>
            if (!isValidMap.data.result.result) {
                return false
            } else {
                const isDifferenceMap = await this.commandCentre.current.cootCommand({
                    command: 'is_a_difference_map',
                    commandArgs: [molNo],
                    returnType: "boolean"
                }, false) as moorhen.WorkerResponse<boolean>
                return !isDifferenceMap.data.result.result
            }
        }))

        const numberOfMaps = validMapMolNos.filter(Boolean).length

        let [h, s, v] = rgbToHsv(0.30000001192092896, 0.30000001192092896, 0.699999988079071)
        h += (10 * numberOfMaps)
        if (h > 360) {
            h -= 360
        }
        const [r, g, b] = hsvToRgb(h, s, v)
        this.defaultMapColour = { r, g, b }
    }
}
