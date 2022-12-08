import { Fragment, useState, useRef, useEffect } from "react";
import { Row } from "react-bootstrap";
import { Autocomplete, TextField } from "@mui/material";

export const BabyGruSearchBar = (props) => {

    const selectRef = useRef()
    const searchBarRef = useRef()
    const [selectedItemKey, setSelectedItemKey] = useState(null)
    const [openPopup, setOpenPopup] = useState(null)

    const handleClick = (element) => {
        console.log(`Search bar is clicking on ${element.id}`)
        let clickEvent = new MouseEvent("click", {
            "view": window,
            "bubbles": true,
            "cancelable": false
        })
        element.dispatchEvent(clickEvent)    
    }

    const getComputedStyle = (element, timeOut=800) => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                console.log('HELO')
                console.log(window.getComputedStyle(element).display)
                resolve(window.getComputedStyle(element))
            }, timeOut)    
        })
    }

    const handleActions = (...actions) => {
        actions.forEach((action, actionIndex) => {
            if (!action.condition) {
                return
            }

            setTimeout(async () => {
                if (action.elementId && !document.getElementById(action.elementId)){
                    return
                }
                if (action.type === 'click'){
                    let element = document.getElementById(action.elementId)
                    handleClick(element)
                } else if (action.type === 'setValue') {
                    console.log(`Search bar is setting a new value ${action.newValue}`)
                    action.valueSetter(action.newValue)
                } else if (action.type === 'setFocus') {
                    console.log(`Search bar is setting focus on component ${action.elementId}`)
                    let element = document.getElementById(action.elementId)
                    element.focus()
                } else if (action.type == 'carousel') {
                    let elements = document.getElementsByClassName('carousel-control-next')
                    let targetElement = document.getElementById(action.elementId)
                    if (elements.length > 0) {
                        while (true) {
                            let computedStyle = await getComputedStyle(targetElement.parentElement.parentElement)
                            if (computedStyle.display !== 'none') {
                                break
                            }
                            handleClick(elements[0])
                        }
                    } 
                    handleClick(targetElement)
                }
            }, parseInt(50 * actionIndex));
        })
    }

    const searchOptions = [
        {label: "Difference Map Peaks", actions: [
            {type: 'click', condition: !props.showSideBar , elementId: 'show-sidebar-button'}, 
            {type: 'click', condition: props.toolAccordionBodyHeight == 0, elementId: 'tools-accordion-button'},
            {type: 'setValue', newValue: 0, condition: true, valueSetter: props.setSelectedToolKey}
        ]},
        {label: "Fetch from PDBe", actions: [
            {type: 'click', elementId: 'file-nav-dropdown', condition: props.currentDropdownId !== "File"}, 
            {type: 'setFocus', elementId: 'fetch-pdbe-form', condition: true}
        ]},
        {label: "Flip Peptide", actions: [
            {type: 'carousel', elementId: 'flip-peptide-edit-button', condition: true}
        ]},
        {label: "Load coordinates", actions: [
            {type: 'click', elementId: 'file-nav-dropdown', condition: props.currentDropdownId !== "File"},
            {type: 'setValue', newValue:'File', valueSetter: props.setCurrentDropdownId, condition: true},
            {type: 'click', elementId: 'upload-coordinates-form', condition: true}
        ]},
        {label: "Load tutorial data", actions: [
            {type: 'click', elementId: 'file-nav-dropdown', condition: props.currentDropdownId !== "File"},
            {type: 'setValue', newValue:'File', valueSetter: props.setCurrentDropdownId, condition: true},
            {type: 'click', elementId: 'load-tutorial-data-menu-item', condition: true}
        ]},
        {label: "Ramachandran Plot", actions: [
            {type: 'click', condition: !props.showSideBar , elementId: 'show-sidebar-button'}, 
            {type: 'click', condition: props.toolAccordionBodyHeight == 0, elementId: 'tools-accordion-button'},
            {type: 'setValue', newValue: 1, condition: true, valueSetter: props.setSelectedToolKey}
        ]},
    ]

    const handleChange = (evt, newSelection) => {
        if (newSelection) {
            const newItemIndex = searchOptions.findIndex(item => item.label == newSelection)
            setSelectedItemKey(newItemIndex)
        } else {
            setSelectedItemKey(null)
        }
    }

    useEffect(() => {
        if (selectedItemKey === null) { 
            return
        }
        selectRef.current.value = selectedItemKey
        if(searchBarRef.current) {
            searchBarRef.current.value = "" 
        } 
        if (selectedItemKey !== null && searchOptions[selectedItemKey]) {
            handleActions(...searchOptions[selectedItemKey].actions)
        }
    }, [selectedItemKey])


    return <Fragment> 
        <Row style={{padding: '0.5rem', width: '20rem'}}>
            <Autocomplete 
                    ref={selectRef}
                    disablePortal
                    selectOnFocus
                    clearOnBlur
                    handleHomeEndKeys
                    freeSolo
                    includeInputInList
                    filterSelectedOptions
                    open={openPopup}
                    onInputChange={(_, value) => {
                        if (value.length === 0) {
                            if (openPopup) setOpenPopup(false);
                        } else {
                              if (!openPopup) setOpenPopup(true);
                        }
                    }}
                    onClose={() => setOpenPopup(false)}
                    sx={{
                        '& .MuiInputBase-root': {
                            backgroundColor:  props.darkMode ? '#222' : 'white',
                            color: props.darkMode ? 'white' : '#222',
                        },
                        '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: props.darkMode ? 'white' : 'grey',
                        },
                        '& .MuiButtonBase-root': {
                            color: props.darkMode ? 'white' : 'grey',
                        },
                        '& .MuiFormLabel-root': {
                            color: props.darkMode ? 'white' : '#222',
                        },
                    }}               
                    onChange={handleChange}
                    size='small'
                    options={searchOptions.map(item => item.label)}
                    renderInput={(params) => <TextField {...params} label="Search" />}
                />
        </Row>
    </Fragment> 

}