import React, { useRef, useState, useEffect, useReducer } from "react";
import { Box } from '@strapi/design-system/Box';
import { Button } from '@strapi/design-system';
import { Grid, GridItem } from '@strapi/design-system';
import { Flex } from '@strapi/design-system';
import { Typography } from '@strapi/design-system';
import { Divider } from '@strapi/design-system';
import { IconButton } from '@strapi/design-system';
import ChevronLeft from '@strapi/icons/ChevronLeft';
import ChevronRight from '@strapi/icons/ChevronRight';
import { Checkbox } from '@strapi/design-system';
import { Loader } from '@strapi/design-system';
import { getCategories, savePlatformExportedCategories } from "../../utils/api";
import { Stack } from '@strapi/design-system';

const TransferLists = ({ platformID, categories, categoriesExport }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [categoriesToExport, dispatchCategoriesToExport] = useReducer(categoriesReducer, { categories: [], isAllCategoriesChecked: false, numberOfItems: 0 });
    const [notExportedCategories, dispatchNotExportedCategories] = useReducer(categoriesReducer, { categories: [], isAllCategoriesChecked: false, numberOfItems: 0 });

    useEffect(async () => {
        const categoriesExportIds = categoriesExport.map(x => x.id)
        const exportCategories = categoriesExport.map(x => { x.isChecked = false; return x })
        const notExported = categories.filter(x => !categoriesExportIds.includes(x.id)).map(x => { x.isChecked = false; return x })
        dispatchNotExportedCategories({ type: 'initialize', payload: notExported })
        dispatchCategoriesToExport({ type: 'initialize', payload: exportCategories })
    }, []);

    function categoriesReducer(state, action) {
        let newState;
        let numberOfSelected
        switch (action.type) {
            case 'add':
                newState = state.categories.concat(action.payload)
                let sortedState = newState.sort((a, b) => a.name > b.name ? 1 : a.name < b.name ? -1 : 0)
                numberOfSelected = newState.filter(x => x.isChecked === true)
                return { ...state, categories: sortedState, isAllCategoriesChecked: false };
            case 'remove':
                let removedIds = action.payload.map(x => x.id)
                newState = state.categories.filter(x => !removedIds.includes(x.id))
                return { ...state, categories: newState, numberOfItems: 0 };
            case 'select':
                newState = state.categories.map(x => {
                    if (x.id === action.payload) {
                        x.isChecked = !x.isChecked
                    };
                    return x
                })
                numberOfSelected = state.categories.filter(x => x.isChecked === true)
                return { categories: newState, isAllCategoriesChecked: numberOfSelected.length === state.categories.length, numberOfItems: numberOfSelected.length };
            case 'selectAll':
                newState = state.categories.map(x => { x.isChecked = action.payload ? false : true; return x })
                return { categories: newState, isAllCategoriesChecked: !state.isAllCategoriesChecked, numberOfItems: action.payload ? 0 : state.categories.length };
            case 'initialize':
                // const newState = state.map(x => x.isChecked = true)
                return { categories: action.payload, isAllCategoriesChecked: false, numberOfItems: 0 };
            default:
                throw new Error();
        }
    }

    const handleAddCategories = () => {
        const categoriesToAdd = notExportedCategories.categories.filter(x => x.isChecked === true).map(x => { x.isChecked = false; return x })
        dispatchCategoriesToExport({ type: "add", payload: categoriesToAdd })
        dispatchNotExportedCategories({ type: "remove", payload: categoriesToAdd })
    }

    const handleRemoveCategories = () => {
        const categoriesToRemove = categoriesToExport.categories.filter(x => x.isChecked === true).map(x => { x.isChecked = false; return x })
        dispatchNotExportedCategories({ type: "add", payload: categoriesToRemove })
        dispatchCategoriesToExport({ type: "remove", payload: categoriesToRemove })
    }

    const handleSave = async () => {
        const categoriesID = categoriesToExport.categories.map(x => x.id)
        setIsSaving(true)
        const message = await savePlatformExportedCategories(platformID, categoriesID)
        setIsSaving(false)
    }

    return (
        <Box paddingTop={2} background="neutral100"> 
            <Flex style={{ "justifyContent": "flex-end", "margin": "8px 0px 16px" }}>
                <Button size="L" onClick={() => handleSave()}>
                    {isSaving ? <Loader small>Loading...</Loader> : "Save"}</Button>
            </Flex>
            <Grid gap={2} padding={0}>
                <GridItem col={5} background="primary100">
                    <Box>
                        <Flex padding={4} direction="column" background="neutral0" shadow="filterShadow">
                            <Typography variant="delta" fontWeight="bold" style={{ "marginBottom": "8px" }}>Κατηγορίες</Typography>
                            <Checkbox disabled={notExportedCategories.categories.length === 0} checked={notExportedCategories.isAllCategoriesChecked}
                                onClick={() => dispatchNotExportedCategories({ type: "selectAll", payload: notExportedCategories.isAllCategoriesChecked })}>
                                {notExportedCategories.numberOfItems}/{notExportedCategories.categories.length} Επιλέχθηκαν
                            </Checkbox>
                            <Divider background="neutral900" paddingTop={2} paddingBottom={2} />
                            <Flex direction="column" style={{ "alignItems": "start" }} >
                                {notExportedCategories && notExportedCategories.categories.map(category =>
                                    <Checkbox
                                        checked={category.isChecked}
                                        key={category.id}
                                        onClick={() => dispatchNotExportedCategories({ type: "select", payload: category.id })}
                                    >{category.name} ({category.products.length})</Checkbox>)}
                            </Flex>
                        </Flex>
                    </Box>
                </GridItem>
                <GridItem col={2}>
                    <Box background="primary100">
                        <Flex direction="column">
                            <IconButton size="L" label="Προσθήκη" icon={<ChevronRight />}
                                onClick={() => handleAddCategories()} />
                            <IconButton size="L" label="Αφαίρεση" icon={<ChevronLeft />}
                                onClick={() => handleRemoveCategories()} />
                        </Flex>
                    </Box>
                </GridItem>
                <GridItem col={5} background="primary100">
                    <Box>
                        <Flex padding={4} direction="column" background="neutral0" shadow="filterShadow">
                            <Typography variant="delta" fontWeight="bold" style={{ "marginBottom": "8px" }}>Κατηγορίες που θα εξαχθούν</Typography>
                            <Checkbox disabled={categoriesToExport.categories.length === 0} checked={categoriesToExport.isAllCategoriesChecked}
                                onClick={() => dispatchCategoriesToExport({ type: "selectAll", payload: categoriesToExport.isAllCategoriesChecked })}>
                                {categoriesToExport.numberOfItems}/{categoriesToExport.categories.length} Επιλέχθηκαν
                            </Checkbox>
                            <Divider unsetMargin={false} paddingTop={2} paddingBottom={2} />
                            <Flex direction="column" style={{ "alignItems": "start" }} >
                                {categoriesToExport && categoriesToExport.categories.map(category =>
                                    <Checkbox
                                        key={category.id}
                                        checked={category.isChecked}
                                        onClick={() => dispatchCategoriesToExport({ type: "select", payload: category.id })}>
                                        {category.name}  ({category.products.length})
                                    </Checkbox>)}
                            </Flex>
                        </Flex>
                    </Box>
                </GridItem>
            </Grid>
        </Box>

    )
}

export default TransferLists